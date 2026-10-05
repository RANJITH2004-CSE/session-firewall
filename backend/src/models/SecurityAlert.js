const mongoose = require('mongoose');

const SecurityAlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  alertType: {
    type: String,
    enum: [
      'NEW_DEVICE',
      'CREDENTIAL_MISUSE',
      'RISK_INCREASE',
      'RESTRICTED_OPERATION',
      'SESSION_TERMINATION',
      'SUSPICIOUS_LOGIN',
      'IMPOSSIBLE_TRAVEL',
      'FAILED_LOGIN_SPIKE',
      'SESSION_HIJACK_ATTEMPT',
      'UNUSUAL_TRANSFER'
    ],
    default: 'SUSPICIOUS_LOGIN'
  },
  riskScore: { type: Number, required: true },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  riskReasons: [{ type: String }],
  details: {
    device: String,
    browser: String,
    os: String,
    ipAddress: String,
    city: String,
    country: String,
    timestamp: { type: Date, default: Date.now }
  },
  customerStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED_BY_CUSTOMER', 'DENIED_BY_CUSTOMER'],
    default: 'PENDING'
  },
  adminStatus: {
    type: String,
    enum: ['Allowed', 'MFA Required', 'Blocked', 'Confirmed Fraud', 'Resolved'],
    default: 'Blocked'
  },
  customerActionAt: { type: Date },
  resolvedAt: { type: Date },
  resolvedBy: { type: String },
  resolutionNotes: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('SecurityAlert', SecurityAlertSchema);
