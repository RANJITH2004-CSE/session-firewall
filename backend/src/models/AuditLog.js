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
  
  // Adaptive Action Triggered
  action: {
    type: String,
    enum: ['ALLOW', 'STEP_UP_REAUTH', 'RESTRICT_ACCESS', 'TERMINATE'],
    required: true
  },
  
  // Multi-Signal Scores
  riskScore: { type: Number, required: true },
  fingerprintIntegrityScore: { type: Number, required: true },
  behavioralConsistencyScore: { type: Number, required: true },
  
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
