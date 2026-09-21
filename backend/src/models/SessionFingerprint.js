const mongoose = require('mongoose');

/**
 * SessionFingerprint Class (UML Fig 10.2)
 * Stores initial composite fingerprint at login and tracks consistency
 * across repeated context sampling during the session lifetime.
 */
const SessionFingerprintSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Baseline Attributes (captured at authentication)
  deviceId: { type: String, required: true },
  browserInfo: { type: String, required: true },
  osInfo: { type: String, required: true },
  networkContext: { type: String, required: true }, // IP address & subnet
  screenResolution: { type: String, default: '1920x1080' },
  hardwareConcurrency: { type: Number, default: 8 },
  canvasHash: { type: String, default: 'cv_7a8f91e0' },
  webglHash: { type: String, default: 'wgl_b4421d98' },
  
  // Computed integrity score (0.0 to 100.0)
  integrityScore: { type: Number, default: 100.0 },
  
  // Repeated context samples taken throughout the session
  sampleHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    deviceStr: String,
    screenResolution: String,
    canvasHash: String,
    computedIntegrity: Number,
    mismatchFactors: [String]
  }],
  
  lastSampledAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('SessionFingerprint', SessionFingerprintSchema);
