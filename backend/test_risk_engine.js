const assert = require('assert');
const { evaluateSessionRisk, getRiskLevel } = require('./src/services/riskEngine');
const { calculateDistanceKm, calculateTravelSpeed } = require('./src/services/geoService');

console.log('=== Running Session Firewall Risk Engine Verification Tests ===\n');

// 1. Verify Haversine Distance & Travel Speed
console.log('[Test 1] Testing Impossible Travel Speed Calculation...');
const mumbai = { latitude: 19.0760, longitude: 72.8777, city: 'Mumbai', country: 'India' };
const newYork = { latitude: 40.7128, longitude: -74.0060, city: 'New York', country: 'United States' };

const dist = calculateDistanceKm(mumbai.latitude, mumbai.longitude, newYork.latitude, newYork.longitude);
console.log(`Distance Mumbai -> New York: ${Math.round(dist)} km (Expected approx 12,500 km)`);
assert(dist > 12000 && dist < 13000, 'Distance between Mumbai and NYC should be ~12,500 km');

// Travel in 30 minutes
const time1 = new Date('2026-09-20T10:00:00Z');
const time2 = new Date('2026-09-20T10:30:00Z');
const speed = calculateTravelSpeed(mumbai, time1, newYork, time2);
console.log(`Speed for Mumbai -> NYC in 30 minutes: ${Math.round(speed)} km/h (Expected > 24,000 km/h)`);
assert(speed > 800, 'Speed must trigger impossible travel (>800 km/h)');
console.log('  ✅ Haversine and Velocity calculation passed.\n');

// 2. Base Mock User
const mockUser = {
  name: 'Alex Mercer',
  trustedDevices: ['Chrome 122 on Windows 11'],
  trustedLocations: [{ city: 'Mumbai', country: 'India' }],
  failedLoginAttempts: 0,
  balance: 24850
};

// 3. Test Safe Login (Low Risk, 0-29 points)
console.log('[Test 2] Testing Safe Login (Known device & location)...');
const safeTelemetry = {
  device: 'Chrome 122 on Windows 11',
  ipAddress: '103.21.244.0',
  location: { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777 },
  isVpn: false
};
const safeRes = evaluateSessionRisk({
  user: mockUser,
  currentTelemetry: safeTelemetry,
  recentSessions: [{
    device: 'Chrome 122 on Windows 11',
    ipAddress: '103.21.244.0',
    location: { city: 'Mumbai', country: 'India' },
    status: 'Allowed'
  }]
});
console.log(`Score: ${safeRes.score}, Level: ${safeRes.riskLevel}, Action: ${safeRes.action}`);
assert.strictEqual(safeRes.score, 0, 'Safe login should score 0');
assert.strictEqual(safeRes.riskLevel, 'low', 'Safe login should be low risk');
assert.strictEqual(safeRes.action, 'ALLOW', 'Safe login should be allowed');
console.log('  ✅ Safe login test passed.\n');

// 4. Test Medium Risk (New device only: 30 pts -> MFA required)
console.log('[Test 3] Testing Medium Risk (New Device: 30 points)...');
const newDeviceTelemetry = {
  device: 'Safari on iPhone 15',
  ipAddress: '103.21.244.0',
  location: { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777 },
  isVpn: false
};
const medRes = evaluateSessionRisk({
  user: mockUser,
  currentTelemetry: newDeviceTelemetry,
  recentSessions: [{
    device: 'Chrome 122 on Windows 11',
    ipAddress: '103.21.244.0',
    location: { city: 'Mumbai', country: 'India' },
    status: 'Allowed'
  }]
});
console.log(`Score: ${medRes.score}, Level: ${medRes.riskLevel}, Action: ${medRes.action}`);
console.log('Reasons:', medRes.reasons);
assert.strictEqual(medRes.score, 30, 'New device should add 30 points');
assert.strictEqual(medRes.riskLevel, 'medium', 'Score 30 should be medium risk');
assert.strictEqual(medRes.action, 'REQUIRE_MFA', 'Medium risk requires MFA');
console.log('  ✅ Medium risk (New Device) test passed.\n');

// 5. Test High Risk (Impossible Travel + Foreign Location + New Device: 40 + 30 + 30 + 15 = 115 pts)
console.log('[Test 4] Testing High Risk (Impossible Travel & Foreign Device)...');
const attackTelemetry = {
  device: 'Firefox 124 on macOS Sonoma',
  ipAddress: '198.51.100.42',
  location: newYork,
  isVpn: false,
  timestamp: time2
};
const previousSession = {
  location: mumbai,
  lastActivityAt: time1,
  createdAt: time1,
  device: 'Chrome 122 on Windows 11',
  ipAddress: '103.21.244.0',
  status: 'Allowed'
};

const highRes = evaluateSessionRisk({
  user: mockUser,
  currentTelemetry: attackTelemetry,
  recentSessions: [previousSession],
  previousSession
});

console.log(`Score: ${highRes.score}, Level: ${highRes.riskLevel}, Action: ${highRes.action}`);
console.log('Reasons:\n' + highRes.reasons.map(r => ` - ${r}`).join('\n'));
assert(highRes.score >= 60, 'Score should exceed High Risk threshold (>=60)');
assert.strictEqual(highRes.riskLevel, 'high', 'Should be high risk');
assert.strictEqual(highRes.action, 'BLOCK', 'Should trigger block');
assert(highRes.flags.impossibleTravel, 'Impossible travel flag must be true');
console.log('  ✅ High risk attack test passed.\n');

// 6. Test Failed Logins rule (+25 pts)
console.log('[Test 5] Testing Failed Logins Rule (+25 pts)...');
const userWithFailedLogins = { ...mockUser, failedLoginAttempts: 4 };
const failedRes = evaluateSessionRisk({
  user: userWithFailedLogins,
  currentTelemetry: safeTelemetry,
  recentSessions: [{
    device: 'Chrome 122 on Windows 11',
    ipAddress: '103.21.244.0',
    location: { city: 'Mumbai', country: 'India' },
    status: 'Allowed'
  }]
});
console.log(`Score with 4 failed logins: ${failedRes.score}`);
assert.strictEqual(failedRes.score, 25, '4 failed logins should add 25 points');
console.log('  ✅ Failed logins test passed.\n');

// 7. Test VPN detection rule (+15 pts)
console.log('[Test 6] Testing VPN detection rule (+15 pts)...');
const vpnTelemetry = { ...safeTelemetry, isVpn: true };
const vpnRes = evaluateSessionRisk({
  user: mockUser,
  currentTelemetry: vpnTelemetry,
  recentSessions: [{
    device: 'Chrome 122 on Windows 11',
    ipAddress: '103.21.244.0',
    location: { city: 'Mumbai', country: 'India' },
    status: 'Allowed'
  }]
});
console.log(`Score with VPN: ${vpnRes.score}`);
assert.strictEqual(vpnRes.score, 15, 'VPN should add 15 points');
console.log('  ✅ VPN detection test passed.\n');

// 8. Test Large/Unusual Transfer rule (+25 pts)
console.log('[Test 7] Testing Large Transfer Rule (+25 pts)...');
const transferRes = evaluateSessionRisk({
  user: mockUser,
  currentTelemetry: safeTelemetry,
  context: { transferAmount: 15000 }
});
console.log(`Score with $15,000 transfer: ${transferRes.score}`);
assert(transferRes.score >= 25, 'Large transfer should add 25 points');
console.log('  ✅ Large transfer rule test passed.\n');

console.log('====================================================');
console.log('🎉 ALL RISK SCORING ENGINE TESTS PASSED SUCCESSFULLY');
console.log('====================================================');
