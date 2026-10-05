const Session = require('../models/Session');
const User = require('../models/User');
const Blocklist = require('../models/Blocklist');
const SecurityAlert = require('../models/SecurityAlert');
const Notification = require('../models/Notification');

/**
 * Returns all active and historical sessions for the current customer
 */
async function getSessions(req, res) {
  try {
    const currentSessionId = req.sessionDoc?.sessionId;
    const sessions = await Session.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    const formatted = sessions.map(s => {
      const obj = s.toObject();
      obj.isCurrent = s.sessionId === currentSessionId;
      return obj;
    });

    return res.status(200).json({
      success: true,
      sessions: formatted,
      currentSessionId
    });
  } catch (err) {
    console.error('[SessionController.getSessions] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve active sessions.' });
  }
}

/**
 * Customer handles "This was not me" / denial of login
 * - Revokes the suspicious session
 * - Ends all active sessions except the current trusted one
 * - Marks suspicious device and IP as blocked in Blocklist
 * - Locks transfers temporarily
 * - Creates/updates alert for Admin Dashboard
 * - Dispatches critical in-app & simulated email warning
 */
async function markNotMe(req, res) {
  try {
    const { targetSessionId } = req.body;
    const currentSessionId = req.sessionDoc?.sessionId;
    const user = req.user;

    // Find the reported session
    const suspiciousSession = targetSessionId 
      ? await Session.findOne({ sessionId: targetSessionId, userId: user._id })
      : await Session.findOne({ userId: user._id, status: { $in: ['Blocked', 'MFA Required'] } }).sort({ createdAt: -1 });

    const targetIp = suspiciousSession?.ipAddress || 'Unknown IP';
    const targetDevice = suspiciousSession?.device || 'Unknown Device';

    // 1. Mark reported session revoked and flagged
    if (suspiciousSession) {
      suspiciousSession.isActive = false;
      suspiciousSession.status = 'Confirmed Fraud';
      suspiciousSession.isDenialReported = true;
      suspiciousSession.denialReportedAt = new Date();
      suspiciousSession.revokedAt = new Date();
      suspiciousSession.revokedReason = 'Customer denied login ("This was not me").';
      await suspiciousSession.save();
    }

    // 2. Terminate all other sessions except current trusted session
    await Session.updateMany(
      {
        userId: user._id,
        sessionId: { $ne: currentSessionId },
        isActive: true
      },
      {
        $set: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'Account lockdown initiated by customer following unauthorized session report.'
        }
      }
    );

    // 3. Add suspicious device and IP to blocklist
    if (targetIp && targetIp !== '127.0.0.1' && targetIp !== '::1') {
      await Blocklist.findOneAndUpdate(
        { type: 'IP', value: targetIp },
        {
          type: 'IP',
          value: targetIp,
          reason: `Customer denied login from this IP address on ${new Date().toISOString()}`,
          isActive: true,
          blockedBy: `Customer ${user.name}`
        },
        { upsert: true }
      );
    }

    if (targetDevice) {
      await Blocklist.findOneAndUpdate(
        { type: 'DEVICE', value: targetDevice },
        {
          type: 'DEVICE',
          value: targetDevice,
          reason: `Customer denied login from this device signature on ${new Date().toISOString()}`,
          isActive: true,
          blockedBy: `Customer ${user.name}`
        },
        { upsert: true }
      );
    }

    // 4. Lock transfers temporarily
    user.transfersLocked = true;
    user.transferLockReason = 'Transfers locked: Customer flagged an unrecognized login. Contact security or change password to restore.';
    user.transferLockedAt = new Date();
    await user.save();

    // 5. Update or create Security Alert for admin
    await SecurityAlert.findOneAndUpdate(
      { userId: user._id, sessionId: suspiciousSession?.sessionId || targetSessionId },
      {
        $set: {
          customerStatus: 'DENIED_BY_CUSTOMER',
          adminStatus: 'Confirmed Fraud',
          customerActionAt: new Date(),
          resolutionNotes: `Customer actively flagged this session as NOT ME. Initiated immediate account lockdown.`
        }
      },
      { upsert: true }
    );

    // 6. Create in-app notification & simulated email with password change instructions
    await Notification.create({
      userId: user._id,
      channel: 'IN_APP',
      title: 'Account Secured: Transfers Locked & Suspicious Sessions Terminated',
      message: 'You reported an unauthorized session. All other active sessions have been terminated, suspicious telemetry quarantined, and transfers disabled for your safety.',
      type: 'SECURITY_ALERT',
      severity: 'critical',
      metadata: {
        actionRequired: true,
        device: targetDevice,
        ipAddress: targetIp
      }
    });

    await Notification.create({
      userId: user._id,
      channel: 'EMAIL_SIMULATED',
      title: '[ACTION REQUIRED] Your SecureBank Account Has Been Locked Following Your Fraud Report',
      message: `
Hello ${user.name},

As requested, we immediately acted on your report that an unrecognized login occurred on your account:
- Suspicious Device Quarantined: ${targetDevice}
- Suspicious IP Quarantined: ${targetIp}
- Transfer Access: Temporarily Disabled
- Active Sessions: Terminated (except your current trusted session)

NEXT STEPS TO RESTORE FULL ACCESS:
1. Navigate to your Security Center and reset your password immediately.
2. Confirm your two-factor verification method.
3. Once verified, our Bank Security Administrator will unlock transfer privileges.

SecureBank Fraud Operations
      `.trim(),
      type: 'SECURITY_ALERT',
      severity: 'critical'
    });

    return res.status(200).json({
      success: true,
      message: 'Account secured: Unrecognized session terminated, transfers locked, and incident sent to Bank Administrator.',
      userState: {
        transfersLocked: user.transfersLocked,
        transferLockReason: user.transferLockReason
      },
      quarantined: {
        device: targetDevice,
        ipAddress: targetIp
      },
      instructions: [
        'All other active sessions have been logged out.',
        'Outgoing wire and ACH transfers are temporarily paused.',
        'Change your online banking password as soon as possible.',
        'Bank Security Operations has been alerted to review the incident.'
      ]
    });

  } catch (err) {
    console.error('[SessionController.markNotMe] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process security denial.' });
  }
}

/**
 * Customer confirms "Yes, it was me"
 */
async function confirmWasMe(req, res) {
  try {
    const { targetSessionId } = req.body;
    const user = req.user;

    const session = await Session.findOne({ sessionId: targetSessionId, userId: user._id });
    if (session) {
      session.status = 'Resolved';
      await session.save();

      // Mark device as trusted
      if (!user.trustedDevices.includes(session.device)) {
        user.trustedDevices.push(session.device);
      }
      // If transfers were locked solely by this pending alert, unlock
      if (user.transfersLocked && user.transferLockReason.includes('High-Risk login attempt')) {
        user.transfersLocked = false;
        user.transferLockReason = '';
      }
      await user.save();
    }

    await SecurityAlert.findOneAndUpdate(
      { userId: user._id, sessionId: targetSessionId },
      {
        $set: {
          customerStatus: 'APPROVED_BY_CUSTOMER',
          adminStatus: 'Resolved',
          customerActionAt: new Date(),
          resolvedAt: new Date(),
          resolvedBy: 'Customer Verified',
          resolutionNotes: 'Customer confirmed this login activity was legitimate.'
        }
      }
    );

    await Notification.create({
      userId: user._id,
      channel: 'IN_APP',
      title: 'Device Verified & Trusted',
      message: `You confirmed the login from ${session?.device || 'your device'}. This device has been added to your trusted profile.`,
      type: 'SYSTEM_UPDATE',
      severity: 'info'
    });

    return res.status(200).json({
      success: true,
      message: 'Login confirmed as legitimate. Device marked as trusted.',
      userState: {
        transfersLocked: user.transfersLocked
      }
    });
  } catch (err) {
    console.error('[SessionController.confirmWasMe] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to confirm login.' });
  }
}

/**
 * Terminate a single specific session
 */
async function terminateSession(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionId, userId: req.user._id });
    
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    session.isActive = false;
    session.revokedAt = new Date();
    session.revokedReason = 'Terminated manually by user from Active Sessions portal.';
    await session.save();

    return res.status(200).json({
      success: true,
      message: `Session ${sessionId} has been terminated successfully.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to terminate session.' });
  }
}

/**
 * Customer or admin explicitly trusts a device signature
 */
async function trustDevice(req, res) {
  try {
    const { deviceName, sessionId } = req.body;
    const user = req.user;

    let targetDevice = deviceName;
    if (!targetDevice && sessionId) {
      const session = await Session.findOne({ sessionId });
      if (session) targetDevice = session.device;
    }

    if (!targetDevice) {
      return res.status(400).json({ success: false, message: 'Device signature or session ID required.' });
    }

    if (!user.trustedDevices.includes(targetDevice)) {
      user.trustedDevices.push(targetDevice);
      await user.save();
    }

    const AuditLog = require('../models/AuditLog');
    const { v4: uuidv4 } = require('uuid');
    await AuditLog.create({
      logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
      sessionId: sessionId || req.sessionDoc?.sessionId || 'SES-TRUST',
      userId: user._id,
      userEmail: user.email,
      eventType: 'DEVICE_ACTION',
      action: 'ALLOW',
      riskScore: 0,
      reason: `Device "${targetDevice}" added to trusted profile.`
    });

    return res.status(200).json({
      success: true,
      message: `Device "${targetDevice}" is now trusted for future logins.`,
      trustedDevices: user.trustedDevices
    });
  } catch (err) {
    console.error('[SessionController.trustDevice] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to trust device.' });
  }
}

module.exports = {
  getSessions,
  markNotMe,
  confirmWasMe,
  terminateSession,
  trustDevice
};
