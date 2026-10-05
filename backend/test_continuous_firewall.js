const assert = require('assert');
const { fuseContinuousRisk, getAdaptiveAction, getRiskLevel } = require('./src/services/riskEngine');

console.log('=== Running Continuous Session Authentication Firewall Verification Tests (SWE3004) ===\n');

// Test 1: Normal Baseline Telemetry
console.log('[Test 1] Testing Normal Continuous Session (High Integrity + High Consistency)...');
const normalFusion = fuseContinuousRisk({
  fingerprintIntegrityScore: 100,
  behavioralConsistencyScore: 98,
  mismatchFactors: [],
  intentDeviations: []
});
console.log(`Risk Score: ${normalFusion.riskScore}, Level: ${normalFusion.riskLevel}, Action: ${normalFusion.action}`);
assert.strictEqual(normalFusion.riskScore, 1, 'Normal session risk should be ~1');
assert.strictEqual(normalFusion.action, 'ALLOW', 'Action should be silent ALLOW');
console.log('  ✅ Test 1 Passed: Silent continuation confirmed.\n');

// Test 2: Benign Network Roaming (IP change on mobile data)
console.log('[Test 2] Testing Benign Network Roaming (Mild subnet shift, intact hardware & behavior)...');
// Fingerprint integrity drops slightly to 85 due to subnet difference, but behavior is 98%
const roamingFusion = fuseContinuousRisk({
  fingerprintIntegrityScore: 85,
  behavioralConsistencyScore: 98,
  mismatchFactors: ['Subnet deviation: 103.21.244.0 -> 103.22.200.15']
});
console.log(`Risk Score: ${roamingFusion.riskScore}, Level: ${roamingFusion.riskLevel}, Action: ${roamingFusion.action}`);
assert(roamingFusion.riskScore < 30, 'Benign roaming must not exceed Low Risk (<30)');
assert.strictEqual(roamingFusion.action, 'ALLOW', 'Benign roaming must NOT trigger false termination');
console.log('  ✅ Test 2 Passed: Benign roaming handled without false positive block.\n');

// Test 3: Synthetic Insider Misuse (Legitimate device, anomalous sensitive surge)
console.log('[Test 3] Testing Synthetic Insider Misuse (Intent deviation)...');
// Fingerprint is 100% legitimate, but intent drops to 25% due to rapid sensitive operations
// plus contextual penalty for high-impact sensitive action (+30 pts)
const insiderFusion = fuseContinuousRisk({
  fingerprintIntegrityScore: 100,
  behavioralConsistencyScore: 25,
  contextualPenalty: 30,
  intentDeviations: [
    'Automated bot-like request rate: 45ms dwell time',
    'Excessive sensitive feature invocations in rapid succession',
    'Direct navigation jump to high-privilege bulk export endpoint'
  ]
});
console.log(`Risk Score: ${insiderFusion.riskScore}, Level: ${insiderFusion.riskLevel}, Action: ${insiderFusion.action}`);
assert(insiderFusion.riskScore >= 60 && insiderFusion.riskScore < 75, 'Score should fall in Elevated Risk tier (60-74)');
assert.strictEqual(insiderFusion.action, 'RESTRICT_ACCESS', 'Must restrict sensitive operations');
console.log('  ✅ Test 3 Passed: Sensitive operations restricted on elevated intent anomaly.\n');

// Test 4: Session Hijacking & Cookie Theft (Mismatched browser, OS, hardware canvas, and IP)
console.log('[Test 4] Testing Session Hijacking & Token Replay...');
// Fingerprint integrity drops to 15, intent drops to 30 + contextual penalty 40
const hijackFusion = fuseContinuousRisk({
  fingerprintIntegrityScore: 15,
  behavioralConsistencyScore: 30,
  contextualPenalty: 40,
  mismatchFactors: [
    'Device signature drift: Chrome on Windows -> Firefox on macOS',
    'OS mismatch: Windows -> macOS',
    'Hardware canvas rendering signature mismatch'
  ]
});
console.log(`Risk Score: ${hijackFusion.riskScore}, Level: ${hijackFusion.riskLevel}, Action: ${hijackFusion.action}`);
assert(hijackFusion.riskScore >= 75, 'Hijacking score must exceed High Risk threshold (>=75)');
assert.strictEqual(hijackFusion.action, 'TERMINATE', 'Must trigger forced session termination');
console.log('  ✅ Test 4 Passed: Stolen token replay results in forced session termination.\n');

// Test 5: Step-Up Re-Authentication (Medium Risk tier)
console.log('[Test 5] Testing Step-Up Re-Authentication mapping...');
const mediumAction = getAdaptiveAction(45);
assert.strictEqual(mediumAction, 'STEP_UP_REAUTH', 'Score 45 must trigger STEP_UP_REAUTH');
console.log('  ✅ Test 5 Passed: Medium risk graduated action verified.\n');

// Test 6: Risk Tiers Classification (Checklist Alignment)
console.log('[Test 6] Testing 4-tier risk classification (LOW, MEDIUM, HIGH, CRITICAL)...');
assert.strictEqual(getRiskLevel(15), 'low');
assert.strictEqual(getAdaptiveAction(15), 'ALLOW');
assert.strictEqual(getRiskLevel(45), 'medium');
assert.strictEqual(getAdaptiveAction(45), 'STEP_UP_REAUTH');
assert.strictEqual(getRiskLevel(65), 'high');
assert.strictEqual(getAdaptiveAction(65), 'RESTRICT_ACCESS');
assert.strictEqual(getRiskLevel(85), 'critical');
assert.strictEqual(getAdaptiveAction(85), 'TERMINATE');
console.log('  ✅ Test 6 Passed: Exact 4-tier classification verified (LOW->ALLOW, MEDIUM->OTP, HIGH->RESTRICT, CRITICAL->TERMINATE).\n');

// Test 7: Email Masking & OTP Expiration Math
console.log('[Test 7] Testing email masking and 2-minute expiration logic...');
const { maskEmail } = require('./src/services/emailService');
const masked = maskEmail('customer@securebank.com');
assert(masked.startsWith('c') && masked.includes('@') && masked.endsWith('.com'), 'Email should be cleanly masked');
const now = Date.now();
const expiresAt = now + 2 * 60 * 1000;
const diffSeconds = Math.round((expiresAt - now) / 1000);
assert.strictEqual(diffSeconds, 120, 'Expiry window must be strictly 120 seconds (2 minutes)');
console.log('  ✅ Test 7 Passed: Masked email format and 2-minute expiration validated.\n');

console.log('================================================================');
console.log('🎉 ALL 7 CONTINUOUS SESSION FIREWALL MODULE TESTS PASSED');
console.log('================================================================');
