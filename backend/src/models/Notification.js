const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: String, enum: ['IN_APP', 'EMAIL_SIMULATED'], default: 'IN_APP' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['SECURITY_ALERT', 'TRANSFER_BLOCKED', 'SESSION_REVOKED', 'SYSTEM_UPDATE', 'MFA_CODE'],
    default: 'SECURITY_ALERT'
  },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  isRead: { type: Boolean, default: false },
  metadata: {
    sessionId: String,
    device: String,
    location: String,
    ipAddress: String,
    timestamp: Date,
    actionRequired: Boolean
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', NotificationSchema);
