const SessionFingerprint = require('../models/SessionFingerprint');

/**
 * Dynamic Session Fingerprinting Module (Architecture Fig 9.1 & Objectives #1)
 * Captures composite fingerprint at login and re-samples throughout the session,
 * computing a fingerprint-integrity score reflecting how consistent the current context is.
 */

/**
 * Initializes session baseline fingerprint at login
 */
async function initializeBaselineFingerprint(sessionId, userId, telemetry) {
  const fingerprint = await SessionFingerprint.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      deviceId: telemetry.device || 'Desktop Browser',
      browserInfo: telemetry.browser || 'Chrome',
      osInfo: telemetry.os || 'Windows',
      networkContext: telemetry.ipAddress || '127.0.0.1',
      screenResolution: telemetry.screenResolution || '1920x1080',
      hardwareConcurrency: telemetry.hardwareConcurrency || 8,
      canvasHash: telemetry.canvasHash || 'cv_default_7a8f9',
      webglHash: telemetry.webglHash || 'wgl_default_b4421',
      integrityScore: 100.0,
      sampleHistory: [{
        timestamp: new Date(),
        ipAddress: telemetry.ipAddress || '127.0.0.1',
        deviceStr: telemetry.device || 'Desktop Browser',
        screenResolution: telemetry.screenResolution || '1920x1080',
        canvasHash: telemetry.canvasHash || 'cv_default_7a8f9',
        computedIntegrity: 100.0,
        mismatchFactors: []
      }],
      lastSampledAt: new Date()
    },
    { upsert: true, new: true }
  );

  return fingerprint;
}

/**
 * Evaluates live telemetry sample against baseline and computes fingerprint-integrity score (0-100)
 */
async function evaluateFingerprintIntegrity(sessionId, currentTelemetry) {
  const baseline = await SessionFingerprint.findOne({ sessionId });
  if (!baseline) {
    return {
      integrityScore: 80.0,
      mismatchFactors: ['No baseline fingerprint found for session']
    };
  }

  let penalty = 0;
  const mismatchFactors = [];

  // 1. Device & OS continuity (Weight: 35)
  if (currentTelemetry.device && baseline.deviceId && currentTelemetry.device !== baseline.deviceId) {
    penalty += 35;
    mismatchFactors.push(`Device signature drift: "${baseline.deviceId}" -> "${currentTelemetry.device}"`);
  } else if (currentTelemetry.os && baseline.osInfo && currentTelemetry.os !== baseline.osInfo) {
    penalty += 30;
    mismatchFactors.push(`OS mismatch: "${baseline.osInfo}" -> "${currentTelemetry.os}"`);
  }

  // 2. Browser family continuity (Weight: 25)
  if (currentTelemetry.browser && baseline.browserInfo && currentTelemetry.browser !== baseline.browserInfo) {
    penalty += 25;
    mismatchFactors.push(`Browser engine shift: "${baseline.browserInfo}" -> "${currentTelemetry.browser}"`);
  }

  // 3. Canvas & Hardware fingerprint (Weight: 20)
  if (currentTelemetry.canvasHash && baseline.canvasHash && currentTelemetry.canvasHash !== baseline.canvasHash) {
    penalty += 20;
    mismatchFactors.push('Hardware canvas rendering signature mismatch');
  }

  // 4. Network / Subnet context (Weight: 15)
  if (currentTelemetry.ipAddress && baseline.networkContext && currentTelemetry.ipAddress !== baseline.networkContext) {
    // Check if within same /24 subnet or complete foreign network
    const baseSubnet = baseline.networkContext.split('.').slice(0, 3).join('.');
    const currSubnet = currentTelemetry.ipAddress.split('.').slice(0, 3).join('.');
    
    if (baseSubnet !== currSubnet && currentTelemetry.ipAddress !== '127.0.0.1' && baseline.networkContext !== '127.0.0.1') {
      penalty += 15;
      mismatchFactors.push(`Subnet deviation: ${baseline.networkContext} -> ${currentTelemetry.ipAddress}`);
    }
  }

  // 5. Screen resolution shift (Weight: 5)
  if (currentTelemetry.screenResolution && baseline.screenResolution && currentTelemetry.screenResolution !== baseline.screenResolution) {
    penalty += 5;
    mismatchFactors.push(`Display geometry changed: ${baseline.screenResolution} -> ${currentTelemetry.screenResolution}`);
  }

  const computedIntegrity = Math.max(0, 100 - penalty);

  // Record sample in history
  baseline.integrityScore = computedIntegrity;
  baseline.lastSampledAt = new Date();
  baseline.sampleHistory.push({
    timestamp: new Date(),
    ipAddress: currentTelemetry.ipAddress || baseline.networkContext,
    deviceStr: currentTelemetry.device || baseline.deviceId,
    screenResolution: currentTelemetry.screenResolution || baseline.screenResolution,
    canvasHash: currentTelemetry.canvasHash || baseline.canvasHash,
    computedIntegrity,
    mismatchFactors
  });

  // Keep last 30 samples
  if (baseline.sampleHistory.length > 30) {
    baseline.sampleHistory = baseline.sampleHistory.slice(-30);
  }

  await baseline.save();

  return {
    integrityScore: computedIntegrity,
    mismatchFactors,
    baseline
  };
}

module.exports = {
  initializeBaselineFingerprint,
  evaluateFingerprintIntegrity
};
