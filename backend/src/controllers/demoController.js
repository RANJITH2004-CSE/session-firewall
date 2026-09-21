const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Session = require('../models/Session');
const SecurityAlert = require('../models/SecurityAlert');
const Notification = require('../models/Notification');
const Blocklist = require('../models/Blocklist');
const Transaction = require('../models/Transaction');
const SessionFingerprint = require('../models/SessionFingerprint');
const BehaviorProfile = require('../models/BehaviorProfile');
const AuditLog = require('../models/AuditLog');
const { evaluateSessionRisk, fuseContinuousRisk } = require('../services/riskEngine');
const { executeAdaptiveResponse } = require('../services/adaptiveResponseService');
const { initializeBaselineFingerprint, evaluateFingerprintIntegrity } = require('../services/fingerprintService');
const { evaluateBehavioralIntent } = require('../services/behavioralIntentService');
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
 * SCENARIO 1: Normal User Session (Baseline Evaluation)
 * Telemetry: Known device in usual location. High integrity (100%) + high intent consistency (96%).
 * Outcome: Low Risk (Score: 2) -> Action: ALLOW. Silent continuation.
 */
async function runScenarioSafeLogin(req, res) {
  try {
    const user = await User.findOne({ email: 'customer@securebank.com' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Demo user not found. Please run seed.' });
    }

    const telemetry = {
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ipAddress: '103.21.244.0',
      screenResolution: '1920x1080',
      canvasHash: 'cv_default_7a8f9',
      location: { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777 },
      isVpn: false,
      timestamp: new Date()
    };

    const sessionId = 'SES-NORMAL-' + uuidv4().substring(0, 8).toUpperCase();
    const session = await Session.create({
      userId: user._id,
      sessionId,
      device: telemetry.device,
      browser: telemetry.browser,
      os: telemetry.os,
      deviceType: telemetry.deviceType,
      ipAddress: telemetry.ipAddress,
      location: telemetry.location,
      isVpn: false,
      riskScore: 2,
      fingerprintIntegrityScore: 100.0,
      behavioralConsistencyScore: 96.0,
      riskReasons: ['Continuous telemetry within normal baseline parameters'],
      riskLevel: 'low',
      adaptiveAction: 'ALLOW',
      status: 'Allowed',
      isActive: true
    });

    await initializeBaselineFingerprint(sessionId, user._id, telemetry);

    // AuditLog
    await AuditLog.create({
      logId: 'AUDIT-' + uuidv4().substring(0, 8).toUpperCase(),
      sessionId,
      userId: user._id,
      userEmail: user.email,
      action: 'ALLOW',
      riskScore: 2,
      fingerprintIntegrityScore: 100.0,
      behavioralConsistencyScore: 96.0,
      targetApplication: 'Enterprise Portal',
      requestEndpoint: '/dashboard',
      reason: 'Normal user session authenticated. Telemetry 100% consistent with baseline.',
      triggerFactors: ['Legitimate device', 'Matching subnet', 'Normal navigation flow']
    });

    return res.status(200).json({
      success: true,
      scenario: 'Scenario 1: Normal User Session',
      description: 'Known device in Mumbai, India. Normal navigation sequencing and timing.',
      scores: {
        riskScore: 2,
        riskLevel: 'low',
        fingerprintIntegrityScore: 100,
        behavioralConsistencyScore: 96,
        action: 'ALLOW'
      },
      session
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * SCENARIO 2: Session Hijacking & Cookie Theft (Report Section 8)
 * Telemetry: Valid session token stolen and replayed from foreign IP & different browser.
 * Fingerprint Integrity drops to 15%. Fused Risk: 85 (High Risk).
 * Outcome: Immediate FORCED TERMINATION & token invalidation.
 */
async function runScenarioSuspiciousLogin(req, res) {
  try {
    const user = await User.findOne({ email: 'customer@securebank.com' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Demo user not found. Please run seed.' });
    }

    const sessionId = 'SES-HIJACK-' + uuidv4().substring(0, 8).toUpperCase();
    const attackerTelemetry = {
      device: 'Firefox 124 on macOS Sonoma',
      browser: 'Firefox',
      os: 'macOS',
      deviceType: 'desktop',
      ipAddress: '198.51.100.42',
      location: { city: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060 },
      isVpn: false,
      timestamp: new Date()
    };

    // Initialize legitimate baseline first
    await initializeBaselineFingerprint(sessionId, user._id, {
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      ipAddress: '103.21.244.0'
    });

    // Evaluate attacker sample
    const fpEval = await evaluateFingerprintIntegrity(sessionId, attackerTelemetry);
    const intentEval = await evaluateBehavioralIntent({
      sessionId,
      userId: user._id,
      endpoint: '/api/gateway/enterprise/bulk-export',
      method: 'POST',
      isSensitiveOperation: true
    });

    const riskEval = fuseContinuousRisk({
      fingerprintIntegrityScore: fpEval.integrityScore,
      behavioralConsistencyScore: intentEval.consistencyScore,
      contextualPenalty: 40, // Impossible travel velocity penalty
      mismatchFactors: fpEval.mismatchFactors,
      intentDeviations: intentEval.deviationReasons
    });

    user.transfersLocked = true;
    user.transferLockReason = `Transfers locked: Session Hijack Anomaly detected (${riskEval.riskScore} pts).`;
    await user.save();

    const blockedSession = await Session.create({
      userId: user._id,
      sessionId,
      device: attackerTelemetry.device,
      browser: attackerTelemetry.browser,
      os: attackerTelemetry.os,
      deviceType: attackerTelemetry.deviceType,
      ipAddress: attackerTelemetry.ipAddress,
      location: attackerTelemetry.location,
      isVpn: false,
      riskScore: riskEval.riskScore,
      fingerprintIntegrityScore: fpEval.integrityScore,
      behavioralConsistencyScore: intentEval.consistencyScore,
      riskReasons: riskEval.reasons,
      riskLevel: 'high',
      adaptiveAction: 'TERMINATE',
      status: 'Blocked',
      isActive: false,
      revokedAt: new Date(),
      revokedReason: 'Continuous Firewall Terminated Session: Cookie Theft / Session Hijacking detected'
    });

    await Blocklist.findOneAndUpdate(
      { type: 'IP', value: attackerTelemetry.ipAddress },
      {
        type: 'IP',
        value: attackerTelemetry.ipAddress,
        reason: 'Quarantined: Session hijacking token replay detected',
        isActive: true,
        blockedBy: 'Continuous Session Firewall'
      },
      { upsert: true }
    );

    const notifs = await sendSuspiciousLoginNotification(user, blockedSession, riskEval);
    const adminAlert = await createAdminSecurityAlert(user, blockedSession, riskEval);

    // Record AuditLog
    await AuditLog.create({
      logId: 'AUDIT-' + uuidv4().substring(0, 8).toUpperCase(),
      sessionId,
      userId: user._id,
      userEmail: user.email,
      action: 'TERMINATE',
      riskScore: riskEval.riskScore,
      fingerprintIntegrityScore: fpEval.integrityScore,
      behavioralConsistencyScore: intentEval.consistencyScore,
      targetApplication: 'Cloud SaaS Workspace',
      requestEndpoint: '/api/gateway/saas/export-database',
      requestMethod: 'POST',
      reason: 'Session Hijacking / Stolen Token Replay detected. Device signature, browser engine, and subnet severely mismatched.',
      triggerFactors: riskEval.reasons,
      clientTelemetry: {
        ipAddress: attackerTelemetry.ipAddress,
        device: attackerTelemetry.device,
        location: 'New York, United States'
      }
    });

    return res.status(200).json({
      success: true,
      scenario: 'Scenario 2: Session Hijacking & Cookie Theft',
      description: 'Stolen token replayed from New York with mismatched browser & OS. Immediate session termination.',
      scores: {
        riskScore: riskEval.riskScore,
        riskLevel: 'high',
        fingerprintIntegrityScore: fpEval.integrityScore,
        behavioralConsistencyScore: intentEval.consistencyScore,
        action: 'TERMINATE'
      },
      session: blockedSession,
      notificationMessage: notifs.alertHeadline
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * SCENARIO 3: Synthetic Insider Misuse / Intent Anomaly (Report Section 8)
 * Legitimate user on legitimate device begins anomalous rapid-fire sensitive operations
 * (bulk export + permission changes). Fingerprint is 100%, but Intent Consistency drops to 30%.
 * Outcome: Elevated Risk (Score: 65) -> Action: RESTRICT_ACCESS (Sensitive operations blocked).
 */
async function runScenarioInsiderMisuse(req, res) {
  try {
    const user = await User.findOne({ email: 'customer@securebank.com' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Demo user not found.' });
    }

    const sessionId = 'SES-INSIDER-' + uuidv4().substring(0, 8).toUpperCase();
    const session = await Session.create({
      userId: user._id,
      sessionId,
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ipAddress: '103.21.244.0',
      location: { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777 },
      isVpn: false,
      riskScore: 68,
      fingerprintIntegrityScore: 100.0,
      behavioralConsistencyScore: 28.0,
      riskReasons: [
        'Behavioral intent deviation (28% consistency)',
        '• Excessive sensitive feature invocations in rapid succession',
        '• Direct navigation jump to high-privilege bulk export endpoint',
        '• Off-hours access pattern anomaly'
      ],
      riskLevel: 'elevated',
      adaptiveAction: 'RESTRICT_ACCESS',
      restrictedOperations: ['bulk_export', 'user_deletion', 'role_escalation', 'wire_transfer'],
      status: 'Allowed',
      isActive: true
    });

    await AuditLog.create({
      logId: 'AUDIT-' + uuidv4().substring(0, 8).toUpperCase(),
      sessionId,
      userId: user._id,
      userEmail: user.email,
      action: 'RESTRICT_ACCESS',
      riskScore: 68,
      fingerprintIntegrityScore: 100.0,
      behavioralConsistencyScore: 28.0,
      targetApplication: 'Enterprise Portal',
      requestEndpoint: '/api/gateway/enterprise/bulk-export',
      requestMethod: 'POST',
      reason: 'Synthetic Insider Misuse: Legitimate device, but behavioral sequence and feature frequency severely anomalous.',
      triggerFactors: [
        'Rapid sensitive operation surge',
        'Direct bulk-export sequence jump',
        'Dwell time anomaly'
      ],
      clientTelemetry: {
        ipAddress: '103.21.244.0',
        device: 'Chrome 122 on Windows 11',
        location: 'Mumbai, India'
      }
    });

    return res.status(200).json({
      success: true,
      scenario: 'Scenario 3: Synthetic Insider Misuse',
      description: 'Legitimate device executing anomalous bulk operations. Fingerprint is intact, but Intent deviates. Action: RESTRICT_ACCESS.',
      scores: {
        riskScore: 68,
        riskLevel: 'elevated',
        fingerprintIntegrityScore: 100,
        behavioralConsistencyScore: 28,
        action: 'RESTRICT_ACCESS'
      },
      restrictedOperations: session.restrictedOperations,
      session
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * SCENARIO 4: Benign Mobile / Network Roaming (Report Section 5 & 8)
 * Legitimate user switches from WiFi to Cellular data. IP changes, but device fingerprint
 * and behavioral interaction patterns remain 100% consistent.
 * Outcome: Low Risk (Score: 8) -> Action: ALLOW. Eliminates false-positive block!
 */
async function runScenarioNetworkRoaming(req, res) {
  try {
    const user = await User.findOne({ email: 'customer@securebank.com' });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Demo user not found.' });
    }

    const sessionId = 'SES-ROAMING-' + uuidv4().substring(0, 8).toUpperCase();
    const session = await Session.create({
      userId: user._id,
      sessionId,
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ipAddress: '103.22.200.15', // Normal mobile network IP change in Delhi/Mumbai
      location: { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777 },
      isVpn: false,
      riskScore: 8,
      fingerprintIntegrityScore: 88.0, // Mild subnet penalty only
      behavioralConsistencyScore: 97.0, // High behavioral consistency
      riskReasons: ['Minor network subnet shift (Cellular roaming) with consistent device fingerprint and user intent'],
      riskLevel: 'low',
      adaptiveAction: 'ALLOW',
      status: 'Allowed',
      isActive: true
    });

    await AuditLog.create({
      logId: 'AUDIT-' + uuidv4().substring(0, 8).toUpperCase(),
      sessionId,
      userId: user._id,
      userEmail: user.email,
      action: 'ALLOW',
      riskScore: 8,
      fingerprintIntegrityScore: 88.0,
      behavioralConsistencyScore: 97.0,
      targetApplication: 'General Gateway',
      requestEndpoint: '/api/gateway/enterprise/overview',
      requestMethod: 'GET',
      reason: 'Benign network roaming: IP address changed, but hardware fingerprint and behavioral intent match profile.',
      triggerFactors: ['Device match confirmed', 'Behavior consistency high', 'Benign network switch']
    });

    return res.status(200).json({
      success: true,
      scenario: 'Scenario 4: Benign Network Roaming',
      description: 'Mobile/WiFi IP switch. Risk fusion avoids false positive because device and intent remain consistent.',
      scores: {
        riskScore: 8,
        riskLevel: 'low',
        fingerprintIntegrityScore: 88,
        behavioralConsistencyScore: 97,
        action: 'ALLOW'
      },
      session
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  resetDemoData,
  runScenarioSafeLogin,
  runScenarioSuspiciousLogin,
  runScenarioInsiderMisuse,
  runScenarioNetworkRoaming
};
