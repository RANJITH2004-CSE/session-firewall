const mongoose = require('mongoose');

/**
 * BehaviorProfile Class (UML Fig 10.2)
 * Models each user's typical interaction patterns (navigation transitions,
 * request timing intervals, feature usage frequencies) to compute behavioral consistency.
 */
const BehaviorProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // Sequence of typical endpoint transitions: e.g., ["/dashboard", "/records", "/reports"]
  typicalSequences: [[String]],
  
  // Statistical distribution of request inter-arrival dwell times (in ms)
  averageDwellTimeMs: { type: Number, default: 2400 }, // ~2.4 seconds between normal clicks
  dwellTimeStdDev: { type: Number, default: 1100 },
  
  // Frequency of invoking sensitive endpoints (e.g. bulk export, user delete, wire transfer)
  sensitiveActionFrequency: { type: Number, default: 0.05 }, // 5% of requests typically
  
  // Typical active hours (0-23)
  typicalActiveHours: [{ type: Number }], // e.g. [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
  
  // Computed consistency score (0.0 to 100.0)
  consistencyScore: { type: Number, default: 95.0 },
  
  totalInteractionsAnalyzed: { type: Number, default: 120 },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('BehaviorProfile', BehaviorProfileSchema);
