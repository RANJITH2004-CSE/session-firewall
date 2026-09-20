const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Session = require('../models/Session');
const SecurityAlert = require('../models/SecurityAlert');
const Notification = require('../models/Notification');
const Blocklist = require('../models/Blocklist');
const Transaction = require('../models/Transaction');
const { evaluateSessionRisk } = require('../services/riskEngine');
const { sendSuspiciousLoginNotification, createAdminSecurityAlert } = require('../services/notificationService');

/**
 * Resets demo state and seeds fresh baseline data
 */
async function resetDemoData(req, res) {
  try {
    const seed = require('../config/seed');
    await seed.runSeed();
    return res.status(200).json({ success: true, message: 'Demo environment reset and seeded successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reset demo data: ' + err.message });
  }
}

/**
 * SCENARIO 1: Safe Login
 * Known device (Chrome on Windows) in usual location (Mumbai, India), low risk, login allowed.
 */
async function runScenarioSafeLogin(req, res) {
  try {
    const customer = await User.findOne({ email: 'customer@securebank.com' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Demo customer not found. Please run seed.' });
    }

    const telemetry = {
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ipAddress: '103.21.244.0',
      location: {
        city: 'Mumbai',
        country: 'India',
        latitude: 19.0760,
        longitude: 72.8777
      },
      isVpn: false,
      timestamp: new Date()
    };

    const recentSessions = await Session.find({ userId: customer._id }).sort({ createdAt: -1 }).limit(10);
    const previousSession = recentSessions[0] || null;

    const riskEval = evaluateSessionRisk({
      user: customer,
      currentTelemetry: telemetry,
      recentSessions,
      previousSession
    });

    const sessionId = 'SES-SAFE-' + uuidv4().substring(0, 8).toUpperCase();
    const session = await Session.create({
      userId: customer._id,
      sessionId,
      device: telemetry.device,
      browser: telemetry.browser,
      os: telemetry.os,
      deviceType: telemetry.deviceType,
      ipAddress: telemetry.ipAddress,
      location: telemetry.location,
      isVpn: telemetry.isVpn,
      riskScore: riskEval.score,
      riskReasons: riskEval.reasons,
      riskLevel: riskEval.riskLevel,
      status: 'Allowed',
      isActive: true
    });

    return res.status(200).json({
      success: true,
      scenario: 'Scenario 1: Safe Login',
      description: 'Known device in usual location (Mumbai, India). Low risk score, login allowed.',
      riskScore: riskEval.score,
      riskLevel: riskEval.riskLevel,
      reasons: riskEval.reasons,
      session
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * SCENARIO 2: Suspicious Login (Impossible Travel & Foreign Device)
 * New device from New York, USA, just 10 minutes after Mumbai, India.
 * Speed: > 10,000 km/h. High risk (Score: 100).
 * Session blocked, transfers locked, notification and admin alert created!
 */
async function runScenarioSuspiciousLogin(req, res) {
  try {
    const customer = await User.findOne({ email: 'customer@securebank.com' });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Demo customer not found. Please run seed.' });
    }

    // Ensure a baseline Mumbai session existed 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const baselineSession = await Session.findOne({
      userId: customer._id,
      'location.city': 'Mumbai'
    }).sort({ createdAt: -1 });

    const previousSession = baselineSession || {
      location: { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777 },
      lastActivityAt: tenMinutesAgo,
      createdAt: tenMinutesAgo
    };

    const telemetry = {
      device: 'Firefox 124 on macOS Sonoma',
      browser: 'Firefox',
      os: 'macOS',
      deviceType: 'desktop',
      ipAddress: '198.51.100.42',
      location: {
        city: 'New York',
        country: 'United States',
        latitude: 40.7128,
        longitude: -74.0060
      },
      isVpn: false,
      timestamp: new Date()
    };

    const recentSessions = await Session.find({ userId: customer._id }).sort({ createdAt: -1 }).limit(10);

    const riskEval = evaluateSessionRisk({
      user: customer,
      currentTelemetry: telemetry,
      recentSessions,
      previousSession
    });

    const sessionId = 'SES-FRAUD-' + uuidv4().substring(0, 8).toUpperCase();

    // Lock customer transfers
    customer.transfersLocked = true;
    customer.transferLockReason = `Transfers locked: Suspicious login from New York detected (Risk score: ${riskEval.score}).`;
    customer.transferLockedAt = new Date();
    await customer.save();

    // Create blocked session
    const blockedSession = await Session.create({
      userId: customer._id,
      sessionId,
      device: telemetry.device,
      browser: telemetry.browser,
      os: telemetry.os,
      deviceType: telemetry.deviceType,
      ipAddress: telemetry.ipAddress,
      location: telemetry.location,
      isVpn: telemetry.isVpn,
      riskScore: riskEval.score,
      riskReasons: riskEval.reasons,
      riskLevel: 'high',
      status: 'Blocked',
      isActive: false,
      revokedAt: new Date(),
      revokedReason: 'Blocked automatically by Session Firewall (Impossible Travel & Foreign Device)'
    });

    // Send customer notification and create admin security alert
    const notifs = await sendSuspiciousLoginNotification(customer, blockedSession, riskEval);
    const adminAlert = await createAdminSecurityAlert(customer, blockedSession, riskEval);

    return res.status(200).json({
      success: true,
      scenario: 'Scenario 2: Suspicious Login (Impossible Travel)',
      description: 'New device in New York, USA, 10 minutes after Mumbai, India. Exceeds airline speed limit.',
      riskScore: riskEval.score,
      riskLevel: riskEval.riskLevel,
      reasons: riskEval.reasons,
      session: blockedSession,
      alertId: adminAlert._id,
      notificationMessage: notifs.alertHeadline,
      transferLockStatus: 'LOCKED'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  resetDemoData,
  runScenarioSafeLogin,
  runScenarioSuspiciousLogin
};
