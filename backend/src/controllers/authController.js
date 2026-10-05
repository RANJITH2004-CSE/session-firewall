const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UAParser } = require('ua-parser-js');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/User');
const Session = require('../models/Session');
const Blocklist = require('../models/Blocklist');
const SecurityAlert = require('../models/SecurityAlert');
const AuditLog = require('../models/AuditLog');
const { evaluateSessionRisk } = require('../services/riskEngine');
const { resolveGeo } = require('../services/geoService');
const { sendSuspiciousLoginNotification, createAdminSecurityAlert } = require('../services/notificationService');
const { sendOtpEmail, generateOtpCode, maskEmail } = require('../services/emailService');
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

  const biometrics = req.body.biometrics || {};

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
    isVpn,
    biometrics
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
      
      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId: 'BLOCKED-' + Date.now(),
        userId: user._id,
        userEmail: user.email,
        eventType: 'LOGIN',
        action: 'TERMINATE',
        riskScore: 100,
        fingerprintIntegrityScore: 0,
        behavioralConsistencyScore: 0,
        reason: `Login rejected: Blocklisted entity (${blockedReason})`,
        clientTelemetry: {
          ipAddress: telemetry.ipAddress,
          device: telemetry.device,
          location: `${telemetry.location.city}, ${telemetry.location.country}`
        }
      });

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

      // Alert if failed login spike
      if (user.failedLoginAttempts >= 3) {
        await SecurityAlert.create({
          userId: user._id,
          sessionId: 'FAIL-' + Date.now(),
          alertType: 'CREDENTIAL_MISUSE',
          riskScore: 65,
          riskLevel: 'high',
          riskReasons: [`Multiple consecutive failed login attempts (${user.failedLoginAttempts})`],
          details: {
            device: telemetry.device,
            browser: telemetry.browser,
            os: telemetry.os,
            ipAddress: telemetry.ipAddress,
            city: telemetry.location?.city,
            country: telemetry.location?.country,
            timestamp: new Date()
          },
          customerStatus: 'PENDING',
          adminStatus: 'Blocked'
        });
      }

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId: 'FAIL-' + Date.now(),
        userId: user._id,
        userEmail: user.email,
        eventType: 'LOGIN',
        action: 'STEP_UP_REAUTH',
        riskScore: user.failedLoginAttempts * 20,
        reason: `Failed login attempt (Total consecutive failures: ${user.failedLoginAttempts})`,
        clientTelemetry: {
          ipAddress: telemetry.ipAddress,
          device: telemetry.device,
          location: `${telemetry.location.city}, ${telemetry.location.country}`
        }
      });

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

    // Administrator SOC Console Access: Allow admins to enter SOC with monitoring
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
        adaptiveAction: 'ALLOW',
        isActive: true,
        lastActivityAt: new Date()
      });

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'LOGIN',
        action: 'ALLOW',
        riskScore: riskEvaluation.score,
        reason: 'Security Administrator login authorized.',
        clientTelemetry: {
          ipAddress: telemetry.ipAddress,
          device: telemetry.device,
          location: `${telemetry.location.city}, ${telemetry.location.country}`
        }
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

    // 5. Check if New Device detected -> trigger NEW_DEVICE security alert
    const isNewDevice = riskEvaluation.flags?.newDevice;
    if (isNewDevice) {
      await SecurityAlert.create({
        userId: user._id,
        sessionId,
        alertType: 'NEW_DEVICE',
        riskScore: riskEvaluation.score,
        riskLevel: riskEvaluation.riskLevel,
        riskReasons: [`New unrecognized device signature: ${telemetry.device}`],
        details: {
          device: telemetry.device,
          browser: telemetry.browser,
          os: telemetry.os,
          ipAddress: telemetry.ipAddress,
          city: telemetry.location?.city,
          country: telemetry.location?.country,
          timestamp: new Date()
        },
        customerStatus: 'PENDING',
        adminStatus: riskEvaluation.score >= 75 ? 'Blocked' : 'Allowed'
      });
    }

    // =========================================================================
    // 6. Handle Risk Tiers for Customer Authentication
    //    LOW:      0 - 29 pts  -> ALLOW
    //    MEDIUM:  30 - 59 pts  -> STEP_UP_REAUTH (Real Gmail OTP Verification)
    //    HIGH:    60 - 74 pts  -> RESTRICT_ACCESS (Restricts sensitive operations)
    //    CRITICAL: 75 - 100 pts -> TERMINATE (Session terminated & blocked)
    // =========================================================================

    // CRITICAL RISK (>= 75 pts): Terminate Session / Block Access
    if (riskEvaluation.score >= 75 || riskEvaluation.riskLevel === 'critical') {
      user.transfersLocked = true;
      user.transferLockReason = `Locked automatically due to Critical Risk login attempt (${riskEvaluation.score} pts).`;
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
        riskLevel: 'critical',
        adaptiveAction: 'TERMINATE',
        status: 'Terminated',
        isActive: false,
        revokedAt: new Date(),
        revokedReason: 'Terminated automatically by Session Firewall (Critical Risk Score >= 75)'
      });

      const notifs = await sendSuspiciousLoginNotification(user, blockedSession, riskEvaluation);
      const adminAlert = await SecurityAlert.create({
        userId: user._id,
        sessionId,
        alertType: 'SESSION_TERMINATION',
        riskScore: riskEvaluation.score,
        riskLevel: 'critical',
        riskReasons: riskEvaluation.reasons,
        details: {
          device: telemetry.device,
          browser: telemetry.browser,
          os: telemetry.os,
          ipAddress: telemetry.ipAddress,
          city: telemetry.location?.city,
          country: telemetry.location?.country,
          timestamp: new Date()
        },
        customerStatus: 'PENDING',
        adminStatus: 'Blocked'
      });

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'LOGIN',
        action: 'TERMINATE',
        riskScore: riskEvaluation.score,
        reason: 'Critical risk login attempt blocked automatically by Session Firewall',
        triggerFactors: riskEvaluation.reasons,
        clientTelemetry: {
          ipAddress: telemetry.ipAddress,
          device: telemetry.device,
          location: `${telemetry.location.city}, ${telemetry.location.country}`
        }
      });

      return res.status(403).json({
        success: false,
        code: 'CRITICAL_RISK_TERMINATED',
        message: 'Session Firewall Alert: Critical risk login attempt detected. Session terminated and transfers locked for account protection.',
        riskScore: riskEvaluation.score,
        riskLevel: 'critical',
        riskReasons: riskEvaluation.reasons,
        sessionId,
        alertHeadline: notifs.alertHeadline,
        alertId: adminAlert._id
      });
    }

    // HIGH RISK (60 - 74 pts): Restrict sensitive operations
    if (riskEvaluation.score >= 60 || riskEvaluation.riskLevel === 'high') {
      user.transfersLocked = true;
      user.transferLockReason = `Restricted access: High risk telemetry profile (${riskEvaluation.score} pts).`;
      user.transferLockedAt = new Date();
      await user.save();

      const restrictedOps = ['transfer', 'bulk_export', 'privilege_escalation', 'tenant_backup', 'change_credentials'];

      const restrictedSession = await Session.create({
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
        adaptiveAction: 'RESTRICT_ACCESS',
        restrictedOperations: restrictedOps,
        status: 'Restricted',
        isActive: true,
        lastActivityAt: new Date()
      });

      await SecurityAlert.create({
        userId: user._id,
        sessionId,
        alertType: 'RESTRICTED_OPERATION',
        riskScore: riskEvaluation.score,
        riskLevel: 'high',
        riskReasons: riskEvaluation.reasons,
        details: {
          device: telemetry.device,
          browser: telemetry.browser,
          os: telemetry.os,
          ipAddress: telemetry.ipAddress,
          city: telemetry.location?.city,
          country: telemetry.location?.country,
          timestamp: new Date()
        },
        customerStatus: 'PENDING',
        adminStatus: 'MFA Required'
      });

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'LOGIN',
        action: 'RESTRICT_ACCESS',
        riskScore: riskEvaluation.score,
        reason: 'High risk login granted with sensitive operations restricted (transfer, export, escalate locked).',
        triggerFactors: riskEvaluation.reasons,
        clientTelemetry: {
          ipAddress: telemetry.ipAddress,
          device: telemetry.device,
          location: `${telemetry.location.city}, ${telemetry.location.country}`
        }
      });

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role, sessionId, restrictedOperations: restrictedOps },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        restricted: true,
        message: 'Session authenticated with restricted access: sensitive operations (transfers, exports) are locked.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          accountNumber: user.accountNumber,
          balance: user.balance,
          transfersLocked: true,
          transferLockReason: user.transferLockReason
        },
        session: restrictedSession
      });
    }

    // MEDIUM RISK (30 - 59 pts): Require Real Gmail OTP Verification
    if (riskEvaluation.score >= 30 || riskEvaluation.riskLevel === 'medium') {
      const otpCode = generateOtpCode();

      // Strict 2-minute expiration and max 3 attempts
      user.tempMfaCode = otpCode;
      user.tempMfaExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // Strictly 2 minutes
      user.tempMfaAttempts = 0; // Reset attempt counter
      await user.save();

      // Dispatch real email via Gmail / nodemailer (Console NEVER prints OTP)
      await sendOtpEmail(user.email, otpCode, {
        device: telemetry.device,
        location: `${telemetry.location.city}, ${telemetry.location.country}`,
        ipAddress: telemetry.ipAddress
      });

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
        adaptiveAction: 'STEP_UP_REAUTH',
        status: 'OTP Verification Required',
        isActive: false
      });

      await createAdminSecurityAlert(user, pendingSession, riskEvaluation);

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'OTP_EVENT',
        action: 'STEP_UP_REAUTH',
        riskScore: riskEvaluation.score,
        reason: 'Step-up OTP verification challenge initiated (Expires in 2 mins, max 3 attempts).',
        triggerFactors: riskEvaluation.reasons,
        clientTelemetry: {
          ipAddress: telemetry.ipAddress,
          device: telemetry.device,
          location: `${telemetry.location.city}, ${telemetry.location.country}`
        }
      });

      // Response strictly contains NO plaintext OTP code
      return res.status(200).json({
        success: true,
        mfaRequired: true,
        message: 'OTP sent to your registered email. Please check your inbox.',
        maskedEmail: maskEmail(user.email),
        expiresInSeconds: 120,
        maxAttempts: 3,
        sessionId,
        userId: user._id,
        riskScore: riskEvaluation.score,
        riskLevel: 'medium',
        riskReasons: riskEvaluation.reasons
      });
    }

    // LOW RISK (0 - 29 pts): Allow Session Immediately
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
      adaptiveAction: 'ALLOW',
      status: 'Allowed',
      isActive: true,
      lastActivityAt: new Date()
    });

    await AuditLog.create({
      logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
      sessionId,
      userId: user._id,
      userEmail: user.email,
      eventType: 'LOGIN',
      action: 'ALLOW',
      riskScore: riskEvaluation.score,
      reason: 'Low-risk baseline authentication successful. Session allowed.',
      clientTelemetry: {
        ipAddress: telemetry.ipAddress,
        device: telemetry.device,
        location: `${telemetry.location.city}, ${telemetry.location.country}`
      }
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
        adaptiveAction: allowedSession.adaptiveAction,
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
    const { userId, sessionId, code, trustDevice } = req.body;
    if (!userId || !sessionId || !code) {
      return res.status(400).json({ success: false, message: 'Missing verification parameters.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // 1. Check max 3 attempts limit
    if ((user.tempMfaAttempts || 0) >= 3) {
      user.tempMfaCode = undefined;
      user.tempMfaExpiresAt = undefined;
      await user.save();

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'OTP_EVENT',
        action: 'TERMINATE',
        riskScore: 70,
        reason: 'Maximum OTP verification attempts (3) exceeded. Passcode invalidated.'
      });

      return res.status(400).json({
        success: false,
        code: 'OTP_MAX_ATTEMPTS',
        message: 'Maximum attempts (3) exceeded. This OTP has been invalidated. Please request a new code.'
      });
    }

    // 2. Check 2-minute expiration
    if (user.tempMfaExpiresAt && new Date() > new Date(user.tempMfaExpiresAt)) {
      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'OTP_EVENT',
        action: 'STEP_UP_REAUTH',
        riskScore: 40,
        reason: 'OTP verification failed: Passcode expired (2-minute window exceeded).'
      });

      return res.status(400).json({
        success: false,
        code: 'OTP_EXPIRED',
        message: 'Verification passcode has expired (2-minute limit). Please request a new code.'
      });
    }

    // 3. Check code match
    if (!user.tempMfaCode || user.tempMfaCode !== code.trim()) {
      user.tempMfaAttempts = (user.tempMfaAttempts || 0) + 1;
      await user.save();

      const remaining = Math.max(0, 3 - user.tempMfaAttempts);

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'OTP_EVENT',
        action: 'STEP_UP_REAUTH',
        riskScore: 45 + (user.tempMfaAttempts * 10),
        reason: `Incorrect OTP entered. Attempt ${user.tempMfaAttempts} of 3.`
      });

      return res.status(400).json({
        success: false,
        code: 'INVALID_OTP',
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining
      });
    }

    // 4. Code is valid! Mark session allowed and active
    const session = await Session.findOne({ sessionId });
    if (session) {
      session.status = 'Allowed';
      session.adaptiveAction = 'ALLOW';
      session.isActive = true;
      session.lastActivityAt = new Date();
      await session.save();
    }

    // 5. Handle "Trust this device"
    if (trustDevice && session && !user.trustedDevices.includes(session.device)) {
      user.trustedDevices.push(session.device);
      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId,
        userId: user._id,
        userEmail: user.email,
        eventType: 'DEVICE_ACTION',
        action: 'ALLOW',
        riskScore: 10,
        reason: `User explicitly trusted device: "${session.device}"`
      });
    }

    // Reset OTP fields
    user.tempMfaCode = undefined;
    user.tempMfaExpiresAt = undefined;
    user.tempMfaAttempts = 0;
    user.failedLoginAttempts = 0;
    await user.save();

    await AuditLog.create({
      logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
      sessionId,
      userId: user._id,
      userEmail: user.email,
      eventType: 'OTP_EVENT',
      action: 'ALLOW',
      riskScore: session?.riskScore || 20,
      reason: 'OTP successfully verified. Step-up challenge passed.'
    });

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

async function resendOtp(req, res) {
  try {
    const { userId, sessionId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required to resend OTP.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const session = sessionId ? await Session.findOne({ sessionId }) : null;

    // Generate new OTP with 2-minute validity and reset attempt counter
    const newOtp = generateOtpCode();
    user.tempMfaCode = newOtp;
    user.tempMfaExpiresAt = new Date(Date.now() + 2 * 60 * 1000);
    user.tempMfaAttempts = 0;
    await user.save();

    await sendOtpEmail(user.email, newOtp, {
      device: session?.device || 'Registered Device',
      location: session?.location ? `${session.location.city}, ${session.location.country}` : 'Unknown Location',
      ipAddress: session?.ipAddress || '127.0.0.1'
    });

    await AuditLog.create({
      logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
      sessionId: sessionId || 'SES-RESEND',
      userId: user._id,
      userEmail: user.email,
      eventType: 'OTP_EVENT',
      action: 'STEP_UP_REAUTH',
      riskScore: 35,
      reason: 'User requested OTP resend. New 2-minute passcode generated.'
    });

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your registered email. Please check your inbox.',
      maskedEmail: maskEmail(user.email),
      expiresInSeconds: 120,
      maxAttempts: 3
    });
  } catch (err) {
    console.error('[AuthController.resendOtp] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to resend OTP.' });
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

      await AuditLog.create({
        logId: 'AUD-' + uuidv4().substring(0, 10).toUpperCase(),
        sessionId: req.sessionDoc.sessionId,
        userId: req.user._id,
        userEmail: req.user.email,
        eventType: 'SESSION_LIFECYCLE',
        action: 'USER_LOGOUT',
        riskScore: 0,
        reason: 'User logged out normally.'
      });
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Logout failed.' });
  }
}

module.exports = {
  login,
  verifyMfa,
  resendOtp,
  getMe,
  logout,
  parseClientTelemetry
};
