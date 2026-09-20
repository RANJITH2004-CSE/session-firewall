const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientName: { type: String, required: true },
  recipientAccount: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['debit', 'credit'], default: 'debit' },
  category: { type: String, default: 'Transfer' },
  description: { type: String },
  status: {
    type: String,
    enum: ['completed', 'blocked', 'flagged_for_review', 'cancelled'],
    default: 'completed'
  },
  riskScore: { type: Number, default: 0 },
  blockReason: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);
