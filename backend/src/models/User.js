const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  accountNumber: { type: String, default: () => 'SB-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000) },
  balance: { type: Number, default: 24850.00 },
  currency: { type: String, default: 'USD' },
  transfersLocked: { type: Boolean, default: false },
  transferLockReason: { type: String, default: '' },
  transferLockedAt: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lastFailedLoginAt: { type: Date },
  trustedDevices: [{ type: String }],
  trustedLocations: [{
    city: String,
    country: String
  }],
  tempMfaCode: { type: String },
  tempMfaExpiresAt: { type: Date },
  tempMfaAttempts: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
