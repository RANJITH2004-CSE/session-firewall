const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UAParser } = require('ua-parser-js');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/User');
const Session = require('../models/Session');
const Blocklist = require('../models/Blocklist');
const { evaluateSessionRisk } = require('../services/riskEngine');
const { resolveGeo } = require('../services/geoService');
const { sendSuspiciousLoginNotification, createAdminSecurityAlert } = require('../services/notificationService');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function parseClientTelemetry(req) {
  const parser = new UAParser(req.headers['user-agent']);
  const parsedUa = parser.getResult();

  // Allow simulator overrides for demo testing
  const simulated = req.body.simulated || {};

  const browserName = simulated.browser || parsedUa.browser.name || 'Chrome';
  const osName = simulated.os || parsedUa.os.name || 'Windows';
  const deviceType = simulated.deviceType || parsedUa.device.type || 'desktop';
  const deviceStr = simulated.device || `${browserName} on ${osName}`;

  const clientIp = simulated.ipAddress || 
    req.headers['x-forwarded-for']?.split(',')[0].trim() || 
    req.socket.remoteAddress || 
    '127.0.0.1';

  const geo = resolveGeo(clientIp, simulated.location);
  const isVpn = simulated.isVpn !== undefined ? simulated.isVpn : geo.isVpn;

  return {
    device: deviceStr,
    browser: browserName,
    os: osName,
    deviceType,
    ipAddress: clientIp,
    location: {
      city: geo.city,
      country: geo.country,
      latitude: geo.latitude,
      longitude: geo.longitude
    },
    isVpn
  };
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Account not found.' });
    }

    const telemetry = parseClientTelemetry(req);

    // 1. Check if IP or device is on the global blocklist
    const blockedIp = await Blocklist.findOne({ type: 'IP', value: telemetry.ipAddress, isActive: true });
    const blockedDevice = await Blocklist.findOne({ type: 'DEVICE', value: telemetry.device, isActive: true });

    if (blockedIp || blockedDevice) {
      const blockedReason = blockedIp ? `IP address (${telemetry.ipAddress}) is blocked` : `Device signature is blocked`;
      return res.status(403).json({
        success: false,
        code: 'ACCESS_QUARANTINED',
        message: `Login blocked by Session Firewall: ${blockedReason}. Please contact bank security operations.`
      });
    }

    // 2. Validate Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      user.lastFailedLoginAt = new Date();
      await user.save();

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your password.',
        failedAttempts: user.failedLoginAttempts
      });
    }

    // 3. Fetch user session history for risk baseline
    const recentSessions = await Session.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const previousSession = recentSessions.length > 0 ? recentSessions[0] : null;

    // 4. Run Risk Scoring Engine
    const riskEvaluation = evaluateSessionRisk({
      user,
      currentTelemetry: telemetry,
      recentSessions,
      previousSession,
      context: { isMidSessionCheck: false }
    });

    const sessionId = 'SES-' + uuidv4().substring(0, 13).toUpperCase();

    // Administrator SOC Console Access: Allow admins to enter SOC while tracking telemetry
    if (user.role === 'admin') {
      const adminSession = await Session.create({
        userId: user._id,
        sessionId,
        device: telemetry.device,
        browser: telemetry.browser,
        os: telemetry.os,
        deviceType: telemetry.deviceType,
        ipAddress: telemetry.ipAddress,
        location: telemetry.location,
        isVpn: telemetry.isVpn,
        riskScore: riskEvaluation.score,
        riskReasons: riskEvaluation.reasons,
        riskLevel: riskEvaluation.riskLevel,
        status: 'Allowed',
        isActive: true,
        lastActivityAt: new Date()
      });

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role, sessionId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountNumber: user.accountNumber,
          balance: user.balance,
          transfersLocked: false
        },
        session: adminSession
      });
    }

    // 5. Handle Risk Tiers for Customers
    if (riskEvaluation.riskLevel === 'high') {
      // HIGH RISK (>= 60 pts): Block transfers, lock session, send notification, create admin alert
      user.transfersLocked = true;
      user.transferLockReason = `Locked automatically due to High-Risk login attempt (${riskEvaluation.score} pts).`;
      user.transferLockedAt = new Date();
      await user.save();

      const blockedSession = await Session.create({
        userId: user._id,
        sessionId,
        device: telemetry.device,
        browser: telemetry.browser,
        os: telemetry.os,
        deviceType: telemetry.deviceType,
        ipAddress: telemetry.ipAddress,
        location: telemetry.location,
        isVpn: telemetry.isVpn,
        riskScore: riskEvaluation.score,
        riskReasons: riskEvaluation.reasons,
        riskLevel: 'high',
        status: 'Blocked',
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'Blocked automatically by Session Firewall (Risk Score >= 60)'
      });

      // Send notifications & admin alert
      const notifs = await sendSuspiciousLoginNotification(user, blockedSession, riskEvaluation);
      const adminAlert = await createAdminSecurityAlert(user, blockedSession, riskEvaluation);

      return res.status(403).json({
        success: false,
        code: 'HIGH_RISK_BLOCKED',
        message: 'Session Firewall Alert: High risk login attempt detected. Session blocked and transfers temporarily locked for account safety.',
        riskScore: riskEvaluation.score,
        riskLevel: 'high',
        riskReasons: riskEvaluation.reasons,
        sessionId,
        alertHeadline: notifs.alertHeadline,
        alertId: adminAlert._id
      });
    }

    if (riskEvaluation.riskLevel === 'medium') {
      // MEDIUM RISK (30 - 59 pts): Require simulated MFA verification
      const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
      user.tempMfaCode = mfaCode;
      user.tempMfaExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      const pendingSession = await Session.create({
        userId: user._id,
        sessionId,
        device: telemetry.device,
        browser: telemetry.browser,
        os: telemetry.os,
        deviceType: telemetry.deviceType,
        ipAddress: telemetry.ipAddress,
        location: telemetry.location,
        isVpn: telemetry.isVpn,
        riskScore: riskEvaluation.score,
        riskReasons: riskEvaluation.reasons,
        riskLevel: 'medium',
        status: 'MFA Required',
        isActive: false
      });

      await createAdminSecurityAlert(user, pendingSession, riskEvaluation);

      return res.status(200).json({
        success: true,
        mfaRequired: true,
        message: 'Additional verification required. A simulated one-time passcode (MFA) has been generated.',
        sessionId,
        riskScore: riskEvaluation.score,
        riskLevel: 'medium',
        riskReasons: riskEvaluation.reasons,
        // Provided for convenient demo testability
        demoMfaCode: mfaCode,
        userId: user._id
      });
    }

    // LOW RISK (0 - 29 pts): Allow session
    user.failedLoginAttempts = 0;
    await user.save();

    const allowedSession = await Session.create({
      userId: user._id,
      sessionId,
      device: telemetry.device,
      browser: telemetry.browser,
      os: telemetry.os,
      deviceType: telemetry.deviceType,
      ipAddress: telemetry.ipAddress,
      location: telemetry.location,
      isVpn: telemetry.isVpn,
      riskScore: riskEvaluation.score,
      riskReasons: riskEvaluation.reasons,
      riskLevel: 'low',
      status: 'Allowed',
      isActive: true,
      lastActivityAt: new Date()
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountNumber: user.accountNumber,
        balance: user.balance,
        transfersLocked: user.transfersLocked,
        transferLockReason: user.transferLockReason
      },
      session: {
        sessionId: allowedSession.sessionId,
        device: allowedSession.device,
        ipAddress: allowedSession.ipAddress,
        location: allowedSession.location,
        riskScore: allowedSession.riskScore,
        riskLevel: allowedSession.riskLevel,
        status: allowedSession.status
      }
    });

  } catch (err) {
    console.error('[AuthController.login] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
  }
}

async function verifyMfa(req, res) {
  try {
    const { userId, sessionId, code } = req.body;
    if (!userId || !sessionId || !code) {
      return res.status(400).json({ success: false, message: 'Missing verification parameters.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.tempMfaCode || user.tempMfaCode !== code.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    if (user.tempMfaExpiresAt && new Date() > new Date(user.tempMfaExpiresAt)) {
      return res.status(400).json({ success: false, message: 'Verification code expired. Please log in again.' });
    }

    // Mark session allowed and active
    const session = await Session.findOne({ sessionId });
    if (session) {
      session.status = 'Allowed';
      session.isActive = true;
      session.lastActivityAt = new Date();
      await session.save();
    }

    // Add device to trusted devices upon successful MFA
    if (session && !user.trustedDevices.includes(session.device)) {
      user.trustedDevices.push(session.device);
    }
    user.tempMfaCode = undefined;
    user.tempMfaExpiresAt = undefined;
    user.failedLoginAttempts = 0;
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'MFA verification successful. Session authenticated.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountNumber: user.accountNumber,
        balance: user.balance,
        transfersLocked: user.transfersLocked
      },
      session
    });
  } catch (err) {
    console.error('[AuthController.verifyMfa] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify MFA code.' });
  }
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id).select('-password');
    return res.status(200).json({
      success: true,
      user,
      currentSession: req.sessionDoc
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
}

async function logout(req, res) {
  try {
    if (req.sessionDoc) {
      req.sessionDoc.isActive = false;
      req.sessionDoc.revokedAt = new Date();
      req.sessionDoc.revokedReason = 'User logged out normally.';
      await req.sessionDoc.save();
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed.' });
  }
}

module.exports = {
  login,
  verifyMfa,
  getMe,
  logout,
  parseClientTelemetry
};
