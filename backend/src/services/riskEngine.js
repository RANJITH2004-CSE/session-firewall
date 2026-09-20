const { calculateTravelSpeed, calculateDistanceKm } = require('./geoService');

// Risk Rule Point Allocations (Strictly as specified)
const RISK_POINTS = {
  NEW_DEVICE: 30,
  NEW_IP: 15,
  UNUSUAL_LOCATION: 30,
  VPN_DETECTED: 15,
  IMPOSSIBLE_TRAVEL: 40,
  FAILED_LOGINS: 25,
  MID_SESSION_DRIFT: 25,
  LARGE_UNUSUAL_TRANSFER: 25
};

const RISK_THRESHOLDS = {
  LOW_MAX: 29,
  MEDIUM_MAX: 59,
  HIGH_MIN: 60
};

/**
 * Determine risk level category based on numerical score
 */
function getRiskLevel(score) {
  if (score >= RISK_THRESHOLDS.HIGH_MIN) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Evaluates session telemetry against historical baseline and returns risk evaluation
 * 
 * @param {Object} params
 * @param {Object} params.user - User document
 * @param {Object} params.currentTelemetry - { device, ipAddress, location, isVpn, userAgent }
 * @param {Array} params.recentSessions - Historical sessions for this user
 * @param {Object} params.previousSession - Most recent active or recorded session
 * @param {Object} params.context - { isMidSessionCheck, transferAmount }
 */
function evaluateSessionRisk({
  user,
  currentTelemetry,
  recentSessions = [],
  previousSession = null,
  context = {}
}) {
  let score = 0;
  const reasons = [];
  const flags = {};

  const { device, ipAddress, location, isVpn } = currentTelemetry;

  // 1. New Device Check (+30 pts)
  // Check if device signature exists in user's trustedDevices or previous allowed sessions
  const knownDevices = new Set([
    ...(user?.trustedDevices || []),
    ...recentSessions.filter(s => s.status === 'Allowed').map(s => s.device)
  ]);

  if (device && !knownDevices.has(device)) {
    score += RISK_POINTS.NEW_DEVICE;
    reasons.push(`Unrecognized device detected: "${device}" (+${RISK_POINTS.NEW_DEVICE} pts)`);
    flags.newDevice = true;
  }

  // 2. New IP Address (+15 pts)
  const knownIps = new Set(recentSessions.filter(s => s.status === 'Allowed').map(s => s.ipAddress));
  // If user has prior sessions and this IP is completely new
  if (recentSessions.length > 0 && !knownIps.has(ipAddress)) {
    score += RISK_POINTS.NEW_IP;
    reasons.push(`New IP address observed: ${ipAddress} (+${RISK_POINTS.NEW_IP} pts)`);
    flags.newIp = true;
  }

  // 3. Unusual City or Country (+30 pts)
  const trustedLocations = user?.trustedLocations || [{ city: 'Mumbai', country: 'India' }];
  const isLocationTrusted = trustedLocations.some(
    tl => tl.country.toLowerCase() === (location?.country || '').toLowerCase() &&
          tl.city.toLowerCase() === (location?.city || '').toLowerCase()
  );
  const seenInRecentSessions = recentSessions.some(
    s => s.status === 'Allowed' &&
         s.location?.country?.toLowerCase() === (location?.country || '').toLowerCase() &&
         s.location?.city?.toLowerCase() === (location?.city || '').toLowerCase()
  );

  if (!isLocationTrusted && !seenInRecentSessions) {
    score += RISK_POINTS.UNUSUAL_LOCATION;
    reasons.push(`Unusual geographic location: ${location?.city}, ${location?.country} (+${RISK_POINTS.UNUSUAL_LOCATION} pts)`);
    flags.unusualLocation = true;
  }

  // 4. VPN / Proxy Detected (+15 pts)
  if (isVpn) {
    score += RISK_POINTS.VPN_DETECTED;
    reasons.push(`VPN, proxy, or data-center exit node identified (+${RISK_POINTS.VPN_DETECTED} pts)`);
    flags.vpnDetected = true;
  }

  // 5. Impossible Travel (+40 pts)
  // e.g., India then USA within 30 minutes (> 800 km/h)
  if (previousSession && previousSession.location && previousSession.createdAt) {
    const lastLoc = previousSession.location;
    const lastTime = previousSession.lastActivityAt || previousSession.createdAt;
    const currentTime = currentTelemetry.timestamp || new Date();

    const speedKmH = calculateTravelSpeed(lastLoc, lastTime, location, currentTime);
    const distanceKm = calculateDistanceKm(lastLoc.latitude, lastLoc.longitude, location.latitude, location.longitude);

    // Speed greater than commercial airliner (800 km/h) over a significant distance (> 200 km)
    if (speedKmH > 800 && distanceKm > 200) {
      const elapsedMinutes = Math.max(1, Math.round(Math.abs(new Date(currentTime) - new Date(lastTime)) / 60000));
      score += RISK_POINTS.IMPOSSIBLE_TRAVEL;
      reasons.push(
        `Impossible travel detected: ${Math.round(distanceKm)} km between ${lastLoc.city}, ${lastLoc.country} and ${location.city}, ${location.country} in ${elapsedMinutes}m (speed: ${Math.round(speedKmH)} km/h) (+${RISK_POINTS.IMPOSSIBLE_TRAVEL} pts)`
      );
      flags.impossibleTravel = true;
      flags.travelStats = { distanceKm: Math.round(distanceKm), speedKmH: Math.round(speedKmH), elapsedMinutes };
    }
  }

  // 6. More than 3 Failed Login Attempts (+25 pts)
  if ((user?.failedLoginAttempts || 0) >= 3) {
    score += RISK_POINTS.FAILED_LOGINS;
    reasons.push(`Account experienced ${user.failedLoginAttempts} consecutive failed login attempts (+${RISK_POINTS.FAILED_LOGINS} pts)`);
    flags.failedLogins = true;
  }

  // 7. IP or Device Changes During an Active Session (+25 pts)
  if (context.isMidSessionCheck && context.activeSession) {
    const origSession = context.activeSession;
    const ipChanged = origSession.ipAddress !== ipAddress;
    const deviceChanged = origSession.device !== device;

    if (ipChanged || deviceChanged) {
      score += RISK_POINTS.MID_SESSION_DRIFT;
      reasons.push(`Mid-session telemetry shift detected: ${ipChanged ? 'IP changed' : ''} ${deviceChanged ? 'Device changed' : ''} (+${RISK_POINTS.MID_SESSION_DRIFT} pts)`);
      flags.midSessionDrift = true;
    }
  }

  // 8. Large or Unusual Transfer Attempt (+25 pts)
  if (context.transferAmount !== undefined && context.transferAmount !== null) {
    const amount = Number(context.transferAmount);
    const balance = user?.balance || 0;
    // Flag if amount > $5,000 or > 50% of balance
    if (amount >= 5000 || (balance > 0 && amount >= (balance * 0.5))) {
      score += RISK_POINTS.LARGE_UNUSUAL_TRANSFER;
      reasons.push(`Large or unusual transfer attempt of $${amount.toLocaleString()} (+${RISK_POINTS.LARGE_UNUSUAL_TRANSFER} pts)`);
      flags.largeTransfer = true;
    }
  }

  const riskLevel = getRiskLevel(score);

  return {
    score,
    riskLevel,
    reasons,
    flags,
    action: riskLevel === 'high' ? 'BLOCK' : (riskLevel === 'medium' ? 'REQUIRE_MFA' : 'ALLOW')
  };
}

module.exports = {
  RISK_POINTS,
  RISK_THRESHOLDS,
  getRiskLevel,
  evaluateSessionRisk
};
