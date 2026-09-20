const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Session = require('../models/Session');
const Transaction = require('../models/Transaction');
const Blocklist = require('../models/Blocklist');
const SecurityAlert = require('../models/SecurityAlert');
const Notification = require('../models/Notification');
const { connectDB } = require('./db');

async function runSeed() {
  console.log('[Seed] Seeding demo data for Session Firewall...');

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Transaction.deleteMany({}),
    Blocklist.deleteMany({}),
    SecurityAlert.deleteMany({}),
    Notification.deleteMany({})
  ]);

  const customerPasswordHash = await bcrypt.hash('Password123!', 10);
  const adminPasswordHash = await bcrypt.hash('AdminSecure123!', 10);

  // 1. Create Demo Customer
  const customer = await User.create({
    name: 'Alex Mercer',
    email: 'customer@securebank.com',
    password: customerPasswordHash,
    role: 'customer',
    accountNumber: 'SB-8829-4102',
    balance: 24850.00,
    currency: 'USD',
    transfersLocked: false,
    failedLoginAttempts: 0,
    trustedDevices: ['Chrome 122 on Windows 11'],
    trustedLocations: [
      { city: 'Mumbai', country: 'India' }
    ]
  });

  // 2. Create Demo Bank Administrator
  const admin = await User.create({
    name: 'Sarah Connor (Security Operations)',
    email: 'admin@securebank.com',
    password: adminPasswordHash,
    role: 'admin',
    accountNumber: 'SB-0001-ADMIN',
    balance: 0,
    transfersLocked: false,
    trustedDevices: ['Chrome on Windows', 'Chrome 122 on Windows 11', 'Desktop Browser', 'Firefox 124 on macOS Sonoma'],
    trustedLocations: [
      { city: 'Mumbai', country: 'India' },
      { city: 'Bengaluru', country: 'India' },
      { city: 'New York', country: 'United States' }
    ]
  });

  // 3. Create Baseline Historical Sessions for Customer (Mumbai, India)
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  await Session.create([
    {
      userId: customer._id,
      sessionId: 'SES-INIT-001',
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ipAddress: '103.21.244.0',
      location: {
        city: 'Mumbai',
        country: 'India',
        latitude: 19.0760,
        longitude: 72.8777
      },
      isVpn: false,
      riskScore: 0,
      riskReasons: [],
      riskLevel: 'low',
      status: 'Allowed',
      isActive: false,
      createdAt: twoDaysAgo,
      lastActivityAt: twoDaysAgo
    },
    {
      userId: customer._id,
      sessionId: 'SES-INIT-002',
      device: 'Chrome 122 on Windows 11',
      browser: 'Chrome',
      os: 'Windows',
      deviceType: 'desktop',
      ipAddress: '103.21.244.0',
      location: {
        city: 'Mumbai',
        country: 'India',
        latitude: 19.0760,
        longitude: 72.8777
      },
      isVpn: false,
      riskScore: 0,
      riskReasons: [],
      riskLevel: 'low',
      status: 'Allowed',
      isActive: true,
      createdAt: fiveHoursAgo,
      lastActivityAt: now
    }
  ]);

  // 4. Sample Transactions
  await Transaction.create([
    {
      userId: customer._id,
      recipientName: 'Apex Cloud Services LLC',
      recipientAccount: 'SB-4491-9921',
      amount: 120.00,
      type: 'debit',
      category: 'Cloud Hosting',
      description: 'Monthly dedicated server cluster',
      status: 'completed',
      riskScore: 0,
      createdAt: new Date(now.getTime() - 36 * 60 * 60 * 1000)
    },
    {
      userId: customer._id,
      recipientName: 'Global Tech Payroll Deposit',
      recipientAccount: 'CORP-PAYROLL-001',
      amount: 6500.00,
      type: 'credit',
      category: 'Income',
      description: 'Bi-weekly Direct Deposit Salary',
      status: 'completed',
      riskScore: 0,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
    },
    {
      userId: customer._id,
      recipientName: 'Metro Power & Water',
      recipientAccount: 'UTIL-3392-019',
      amount: 145.50,
      type: 'debit',
      category: 'Utilities',
      description: 'Electric & utility bill payment',
      status: 'completed',
      riskScore: 0,
      createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000)
    }
  ]);

  // 5. Initial Blocklist items (Known malicious botnets / exit nodes)
  await Blocklist.create([
    {
      type: 'IP',
      value: '185.220.101.5',
      reason: 'Known malicious Tor exit node and credential-stuffing origin',
      isActive: true,
      blockedBy: 'Automated Threat Intelligence'
    },
    {
      type: 'DEVICE',
      value: 'HeadlessChrome on Linux x86_64',
      reason: 'Automated headless scraping & session hijacking tool signature',
      isActive: true,
      blockedBy: 'Session Firewall Policy Engine'
    }
  ]);

  // 6. Pre-existing resolved alert for demonstration
  await SecurityAlert.create({
    userId: customer._id,
    sessionId: 'SES-PAST-MFA',
    alertType: 'SUSPICIOUS_LOGIN',
    riskScore: 45,
    riskLevel: 'medium',
    riskReasons: [
      'Unrecognized device detected: "Safari on iPhone 15" (+30 pts)',
      'New IP address observed: 103.22.200.15 (+15 pts)'
    ],
    details: {
      device: 'Safari on iPhone 15',
      browser: 'Safari',
      os: 'iOS',
      ipAddress: '103.22.200.15',
      city: 'Delhi',
      country: 'India',
      timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000)
    },
    customerStatus: 'APPROVED_BY_CUSTOMER',
    adminStatus: 'Resolved',
    customerActionAt: new Date(now.getTime() - 71 * 60 * 60 * 1000),
    resolvedAt: new Date(now.getTime() - 71 * 60 * 60 * 1000),
    resolvedBy: 'Customer Verified',
    resolutionNotes: 'Customer passed MFA challenge and confirmed device.'
  });

  console.log('[Seed] Demo data seeded successfully.');
  console.log('  Customer: customer@securebank.com / Password123!');
  console.log('  Admin:    admin@securebank.com / AdminSecure123!');
}

if (require.main === module) {
  connectDB()
    .then(runSeed)
    .then(() => {
      console.log('[Seed] Exiting...');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { runSeed };
