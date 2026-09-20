const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Blocklist = require('../models/Blocklist');
const { evaluateSessionRisk } = require('../services/riskEngine');
const { resolveGeo } = require('../services/geoService');

const JWT_SECRET = process.env.JWT_SECRET || 'secure-session-firewall-jwt-secret-key-2026';

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or account deactivated.' });
    }

    // Retrieve active session
    let sessionDoc = null;
    if (decoded.sessionId) {
      sessionDoc = await Session.findOne({ sessionId: decoded.sessionId });
      
      if (!sessionDoc) {
        return res.status(401).json({ success: false, message: 'Session does not exist. Please log in again.' });
      }

      if (!sessionDoc.isActive) {
        return res.status(403).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: `Session terminated: ${sessionDoc.revokedReason || 'Session was revoked for security reasons.'}`
        });
      }

      // Check if IP or device is on the global blocklist
      const isIpBlocked = await Blocklist.findOne({ type: 'IP', value: sessionDoc.ipAddress, isActive: true });
      const isDeviceBlocked = await Blocklist.findOne({ type: 'DEVICE', value: sessionDoc.device, isActive: true });

      if (isIpBlocked || isDeviceBlocked) {
        sessionDoc.isActive = false;
        sessionDoc.status = 'Blocked';
        sessionDoc.revokedAt = new Date();
        sessionDoc.revokedReason = 'Device or IP is present on the security blocklist.';
        await sessionDoc.save();

        return res.status(403).json({
          success: false,
          code: 'BLOCKLISTED',
          message: 'Access blocked: This IP address or device has been quarantined due to confirmed security alerts.'
        });
      }

      // Update session activity timestamp
      sessionDoc.lastActivityAt = new Date();
      await sessionDoc.save();
    }

    req.user = user;
    req.sessionDoc = sessionDoc;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication session.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden. Administrator privileges required.' });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  JWT_SECRET
};
