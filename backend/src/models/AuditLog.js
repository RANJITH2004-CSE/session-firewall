const mongoose = require('mongoose');

/**
 * AuditLog Class (UML Fig 10.2 & Functional Requirement FR9)
 * Logs every continuous evaluation event, risk-score fluctuation, and adaptive action.
 */
const AuditLogSchema = new mongoose.Schema({
  logId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String },
  
  // Event Type Category
  eventType: {
    type: String,
    enum: ['LOGIN', 'RISK_CHANGE', 'OTP_EVENT', 'SENSITIVE_ACTION', 'SESSION_LIFECYCLE', 'DEVICE_ACTION', 'ADAPTIVE_EVALUATION'],
    default: 'ADAPTIVE_EVALUATION'
  },

  // Adaptive Action Triggered or Operational Result
  action: {
    type: String,
    required: true
  },
  
  // Multi-Signal Scores
  riskScore: { type: Number, default: 0 },
  fingerprintIntegrityScore: { type: Number, default: 100 },
  behavioralConsistencyScore: { type: Number, default: 100 },
  
  // Context & Destination
  targetApplication: {
    type: String,
    enum: ['Enterprise Portal', 'Cloud SaaS Workspace', 'Banking FinTech', 'General Gateway'],
    default: 'General Gateway'
  },
  requestEndpoint: { type: String },
  requestMethod: { type: String, default: 'GET' },
  
  // Explanatory Rationale
  reason: { type: String, required: true },
  triggerFactors: [{ type: String }],
  
  // Client Telemetry Snapshot
  clientTelemetry: {
    ipAddress: String,
    device: String,
    location: String
  },
  
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
