const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, unique: true },
  tokenHash: { type: String },
  device: { type: String, default: 'Desktop Browser' },
  browser: { type: String, default: 'Chrome' },
  os: { type: String, default: 'Windows' },
  deviceType: { type: String, default: 'desktop' },
  ipAddress: { type: String, default: '127.0.0.1' },
  location: {
    city: { type: String, default: 'Mumbai' },
    country: { type: String, default: 'India' },
    latitude: { type: Number, default: 19.0760 },
    longitude: { type: Number, default: 72.8777 }
  },
  isVpn: { type: Boolean, default: false },
  riskScore: { type: Number, default: 0 },
  riskReasons: [{ type: String }],
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  status: {
    type: String,
    enum: ['Allowed', 'MFA Required', 'Blocked', 'Confirmed Fraud', 'Resolved'],
    default: 'Allowed'
  },
  isActive: { type: Boolean, default: true },
  isDenialReported: { type: Boolean, default: false },
  denialReportedAt: { type: Date },
  lastActivityAt: { type: Date, default: Date.now },
  revokedAt: { type: Date },
  revokedReason: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Session', SessionSchema);
