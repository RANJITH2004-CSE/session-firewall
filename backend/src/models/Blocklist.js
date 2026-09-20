const mongoose = require('mongoose');

const BlocklistSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['IP', 'DEVICE'],
    required: true
  },
  value: {
    type: String,
    required: true,
    unique: true
  },
  reason: {
    type: String,
    default: 'Blocked due to suspicious behavior or customer fraud report'
  },
  blockedBy: {
    type: String,
    default: 'Session Firewall'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    ip: String,
    device: String,
    location: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Blocklist', BlocklistSchema);
