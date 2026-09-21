const BehaviorProfile = require('../models/BehaviorProfile');

// In-memory sliding window of recent requests per session: { sessionId: [ { endpoint, timestamp, method } ] }
const sessionRequestWindows = new Map();

/**
 * Behavioral Intent Analysis Module (Architecture Fig 9.1 & Objectives #2)
 * Models user's typical interaction patterns (navigation, timing, feature usage)
 * and detects deviations indicating hijacking, credential theft, or insider misuse.
 */

/**
 * Get or create behavior profile for user
 */
async function getOrCreateProfile(userId) {
  let profile = await BehaviorProfile.findOne({ userId });
  if (!profile) {
    profile = await BehaviorProfile.create({
      userId,
      typicalSequences: [
        ['/dashboard', '/records', '/reports'],
        ['/dashboard', '/transfers', '/confirm'],
        ['/workspace', '/projects', '/tasks'],
        ['/admin/overview', '/admin/users', '/admin/audit']
      ],
      averageDwellTimeMs: 2500,
      dwellTimeStdDev: 1200,
      sensitiveActionFrequency: 0.05,
      typicalActiveHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      consistencyScore: 95.0
    });
  }
  return profile;
}

/**
 * Evaluates live request against user behavioral profile
 * 
 * @param {Object} params
 * @param {String} params.sessionId
 * @param {String} params.userId
 * @param {String} params.endpoint - e.g. "/api/gateway/enterprise/bulk-export"
 * @param {String} params.method - e.g. "POST"
 * @param {Boolean} params.isSensitiveOperation
 */
async function evaluateBehavioralIntent({ sessionId, userId, endpoint, method = 'GET', isSensitiveOperation = false }) {
  const profile = await getOrCreateProfile(userId);
  const now = Date.now();

  if (!sessionRequestWindows.has(sessionId)) {
    sessionRequestWindows.set(sessionId, []);
  }

  const window = sessionRequestWindows.get(sessionId);
  const previousRequest = window.length > 0 ? window[window.length - 1] : null;

  let penalty = 0;
  const deviationReasons = [];

  // 1. Inter-arrival Dwell Time Anomaly
  if (previousRequest) {
    const elapsedMs = now - previousRequest.timestamp;

    // Sub-100ms rapid fire indicates automated script / bot replay
    if (elapsedMs < 100) {
      penalty += 30;
      deviationReasons.push(`Automated bot-like request rate: ${elapsedMs}ms dwell time (<100ms threshold)`);
    } else if (elapsedMs < 300) {
      penalty += 15;
      deviationReasons.push(`Unusually rapid inter-arrival timing: ${elapsedMs}ms`);
    }
  }

  // 2. Sensitive Feature Usage Surge (Insider Misuse / Privilege Abuse)
  if (isSensitiveOperation) {
    const recentSensitiveCount = window.filter(r => r.isSensitive).length;
    // If user executes 3+ sensitive operations in a 10-request window
    if (recentSensitiveCount >= 2) {
      penalty += 35;
      deviationReasons.push(`Excessive sensitive feature invocations (${recentSensitiveCount + 1} in recent window)`);
    } else {
      penalty += 10;
      deviationReasons.push(`Sensitive operation invoked: ${endpoint}`);
    }
  }

  // 3. Navigation Sequence Jump
  // Direct access to high-impact administrative or export endpoints without preceding dashboard navigation
  if (window.length < 2 && (endpoint.includes('export') || endpoint.includes('bulk') || endpoint.includes('delete') || endpoint.includes('transfer'))) {
    penalty += 25;
    deviationReasons.push(`Anomalous navigation sequence: immediate direct jump to sensitive endpoint "${endpoint}"`);
  }

  // 4. Temporal Outlier Check (Outside typical working hours)
  const currentHour = new Date().getHours();
  if (profile.typicalActiveHours && profile.typicalActiveHours.length > 0 && !profile.typicalActiveHours.includes(currentHour)) {
    penalty += 10;
    deviationReasons.push(`Off-hours activity: Current hour (${currentHour}:00) deviates from profile baseline`);
  }

  const computedConsistency = Math.max(0, 100 - penalty);

  // Append to rolling window
  window.push({ endpoint, method, timestamp: now, isSensitive: isSensitiveOperation });
  if (window.length > 15) {
    window.shift();
  }

  // Update profile record
  profile.consistencyScore = computedConsistency;
  profile.lastUpdated = new Date();
  await profile.save();

  return {
    consistencyScore: computedConsistency,
    deviationReasons,
    isAnomalous: computedConsistency < 60
  };
}

/**
 * Resets intent window for session (e.g. on logout or re-auth)
 */
function clearSessionWindow(sessionId) {
  sessionRequestWindows.delete(sessionId);
}

module.exports = {
  getOrCreateProfile,
  evaluateBehavioralIntent,
  clearSessionWindow
};
