// LOCATION: backend/models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  amount:      { type: Number,  required: true, min: 0 },
  category: {
    type:     String,
    required: true,
    enum:     ['Food', 'Transport', 'Entertainment', 'Games', 'Shopping', 'Bills', 'Health', 'Other'],
  },
  description: { type: String, default: '' },
  date:        { type: Date,   default: Date.now },
}, { timestamps: true });

TransactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Transaction', TransactionSchema);