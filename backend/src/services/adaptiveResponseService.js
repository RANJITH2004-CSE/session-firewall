const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const Blocklist = require('../models/Blocklist');

/**
 * Adaptive Response Module (Architecture Fig 9.1, Objectives #4 & FR6, FR7, FR8, FR9)
 * Triggers proportionate graduated security actions instead of a single binary allow/deny decision.
 */

/**
 * Executes graduated adaptive response and creates AuditLog entry
 */
async function executeAdaptiveResponse({
  session,
  user,
  riskEvaluation,
  targetApplication = 'General Gateway',
  requestEndpoint = '/',
  requestMethod = 'GET',
  clientTelemetry = {}
}) {
  const { action, riskScore, fingerprintIntegrityScore, behavioralConsistencyScore, reasons } = riskEvaluation;
  const logId = 'AUDIT-' + uuidv4().substring(0, 10).toUpperCase();

  // Update session record with latest continuous evaluation
  session.riskScore = riskScore;
  session.fingerprintIntegrityScore = fingerprintIntegrityScore;
  session.behavioralConsistencyScore = behavioralConsistencyScore;
  session.adaptiveAction = action;
  session.currentApplication = targetApplication;
  session.lastActivityAt = new Date();

  let executionResult = {
    action,
    riskScore,
    fingerprintIntegrityScore,
    behavioralConsistencyScore,
    reasons,
    allowed: true,
    restricted: false,
    challengeRequired: false,
    terminated: false
  };

  // 1. Action: FORCED TERMINATION (High Risk >= 75) - FR8
  if (action === 'TERMINATE') {
    session.isActive = false;
    session.status = 'Blocked';
    session.revokedAt = new Date();
    session.revokedReason = `Continuous Firewall Terminated Session: Cumulative Risk Score (${riskScore}) exceeded threshold. Reasons: ${reasons.join(', ')}`;
    await session.save();

    // Add to global blocklist if severe anomaly
    if (clientTelemetry.ipAddress && clientTelemetry.ipAddress !== '127.0.0.1') {
      await Blocklist.findOneAndUpdate(
        { type: 'IP', value: clientTelemetry.ipAddress },
        {
          type: 'IP',
          value: clientTelemetry.ipAddress,
          reason: `Automatic quarantine by Continuous Session Firewall (Score: ${riskScore})`,
          isActive: true,
          blockedBy: 'Continuous Session Firewall'
        },
        { upsert: true }
      );
    }

    // In-app & email notification
    await Notification.create({
      userId: user._id,
      channel: 'IN_APP',
      title: 'Session Quarantined: High Risk Telemetry Detected',
      message: `Your active session was terminated by the Continuous Firewall due to severe fingerprint or intent anomalies (Risk: ${riskScore}).`,
      type: 'SESSION_REVOKED',
      severity: 'critical',
      metadata: {
        sessionId: session.sessionId,
        device: clientTelemetry.device,
        ipAddress: clientTelemetry.ipAddress,
        actionRequired: true
      }
    });

    executionResult.allowed = false;
    executionResult.terminated = true;
  }

  // 2. Action: RESTRICT SENSITIVE OPERATIONS (Elevated Risk 60-74) - FR7
  else if (action === 'RESTRICT_ACCESS') {
    session.status = 'Allowed';
    session.restrictedOperations = [
      'bulk_export',
      'user_deletion',
      'role_escalation',
      'wire_transfer',
      'security_settings_change'
    ];
    await session.save();

    executionResult.allowed = true;
    executionResult.restricted = true;
    executionResult.restrictedOperations = session.restrictedOperations;
  }

  // 3. Action: STEP-UP RE-AUTHENTICATION (Medium Risk 30-59) - FR6
  else if (action === 'STEP_UP_REAUTH') {
    session.status = 'MFA Required';
    await session.save();

    executionResult.allowed = true;
    executionResult.challengeRequired = true;
  }

  // 4. Action: SILENT ALLOW (Low Risk 0-29) - Normal continuation
  else {
    session.status = 'Allowed';
    session.restrictedOperations = [];
    await session.save();

    executionResult.allowed = true;
  }

  // Record AuditLog entry (FR9)
  await AuditLog.create({
    logId,
    sessionId: session.sessionId,
    userId: user._id,
    userEmail: user.email,
    action,
    riskScore,
    fingerprintIntegrityScore,
    behavioralConsistencyScore,
    targetApplication,
    requestEndpoint,
    requestMethod,
    reason: reasons.length > 0 ? reasons.join(' | ') : 'Continuous telemetry within normal baseline parameters',
    triggerFactors: reasons,
    clientTelemetry: {
      ipAddress: clientTelemetry.ipAddress || session.ipAddress,
      device: clientTelemetry.device || session.device,
      location: clientTelemetry.location?.city ? `${clientTelemetry.location.city}, ${clientTelemetry.location.country}` : 'Local'
    }
  });

  return executionResult;
}

module.exports = {
  executeAdaptiveResponse
};
