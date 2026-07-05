// LOCATION: backend/models/MonthlyBudget.js
// Stores one budget entry per user per calendar month.
// balance = the income/budget the user sets at the start of each month.
const mongoose = require('mongoose');

const MonthlyBudgetSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  month:   { type: Number, required: true, min: 1, max: 12 },   // 1–12
  year:    { type: Number, required: true },                      // e.g. 2026
  balance: { type: Number, required: true, min: 0 },
}, { timestamps: true });

// One budget per user per month/year — enforce uniqueness
MonthlyBudgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyBudget', MonthlyBudgetSchema);