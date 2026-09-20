const Notification = require('../models/Notification');
const SecurityAlert = require('../models/SecurityAlert');

/**
 * Sends customer in-app notification & simulated email
 */
async function sendSuspiciousLoginNotification(user, session, riskDetails) {
  const timeFormatted = new Date(session.createdAt || Date.now()).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const deviceStr = session.browser && session.os 
    ? `${session.browser} on ${session.os}` 
    : session.device;

  const locationStr = session.location?.city || 'Unknown Location';
  
  // As requested: "Suspicious login detected from Chrome on Windows in New York at 10:35 AM. Was this you?"
  const alertHeadline = `Suspicious login detected from ${deviceStr} in ${locationStr} at ${timeFormatted}. Was this you?`;

  // 1. In-App Notification
  const inApp = await Notification.create({
    userId: user._id,
    channel: 'IN_APP',
    title: 'Security Alert: Suspicious Login Detected',
    message: alertHeadline,
    type: 'SECURITY_ALERT',
    severity: 'critical',
    metadata: {
      sessionId: session.sessionId,
      device: deviceStr,
      location: `${locationStr}, ${session.location?.country || ''}`,
      ipAddress: session.ipAddress,
      timestamp: session.createdAt,
      actionRequired: true
    }
  });

  // 2. Simulated Outgoing Email
  const emailContent = `
Dear ${user.name},

Our Session Firewall detected unusual activity on your SecureBank account.
Details:
- Device: ${deviceStr}
- Location: ${locationStr}, ${session.location?.country || ''}
- IP Address: ${session.ipAddress}
- Risk Score: ${riskDetails.score} / 100 (${riskDetails.riskLevel.toUpperCase()} RISK)
- Risk Factors:
  ${riskDetails.reasons.map(r => `• ${r}`).join('\n  ')}

If this was NOT you, please secure your account immediately via your dashboard. Transfers have been automatically restricted for your protection.

SecureBank Fraud Detection Unit
  `.trim();

  const emailSim = await Notification.create({
    userId: user._id,
    channel: 'EMAIL_SIMULATED',
    title: `[URGENT] Security Alert: Suspicious Login Detected on Your SecureBank Account`,
    message: emailContent,
    type: 'SECURITY_ALERT',
    severity: 'critical',
    metadata: {
      sessionId: session.sessionId,
      device: deviceStr,
      location: `${locationStr}, ${session.location?.country || ''}`,
      ipAddress: session.ipAddress,
      timestamp: session.createdAt,
      actionRequired: true
    }
  });

  return { inApp, emailSim, alertHeadline };
}

/**
 * Creates security alert record for admin monitoring
 */
async function createAdminSecurityAlert(user, session, riskDetails) {
  const alert = await SecurityAlert.create({
    userId: user._id,
    sessionId: session.sessionId,
    alertType: riskDetails.flags?.impossibleTravel ? 'IMPOSSIBLE_TRAVEL' : 'SUSPICIOUS_LOGIN',
    riskScore: riskDetails.score,
    riskLevel: riskDetails.riskLevel,
    riskReasons: riskDetails.reasons,
    details: {
      device: session.device,
      browser: session.browser,
      os: session.os,
      ipAddress: session.ipAddress,
      city: session.location?.city,
      country: session.location?.country,
      timestamp: session.createdAt || new Date()
    },
    customerStatus: 'PENDING',
    adminStatus: riskDetails.riskLevel === 'high' ? 'Blocked' : (riskDetails.riskLevel === 'medium' ? 'MFA Required' : 'Allowed')
  });

  return alert;
}

module.exports = {
  sendSuspiciousLoginNotification,
  createAdminSecurityAlert
};
