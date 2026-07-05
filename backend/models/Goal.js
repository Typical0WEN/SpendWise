// LOCATION: backend/models/Goal.js
const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    index:    true,
  },
  title: {
    type:     String,
    required: true,
    trim:     true,
  },
  targetAmount: {
    type:     Number,
    required: true,
    min:      1,
  },
  currentAmount: {
    type:    Number,
    default: 0,
    min:     0,
  },
  deadline: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('Goal', GoalSchema);