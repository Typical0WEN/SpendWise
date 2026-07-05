// LOCATION: backend/routes/insights.js
const express     = require('express');
const Transaction = require('../models/Transaction');
const auth        = require('../middleware/auth');

const router = express.Router();

// ── GET /api/insights — spending summary for the logged-in user ──
router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id });

    if (transactions.length === 0) {
      return res.json({
        total:      0,
        average:    0,
        count:      0,
        categories: {},
        anomalies:  [],
      });
    }

    // Total and average
    const total   = transactions.reduce((sum, t) => sum + t.amount, 0);
    const average = total / transactions.length;

    // Category breakdown
    const categories = {};
    transactions.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    // Simple anomaly detection: flag any transaction more than 2x the average
    const threshold = average * 2;
    const anomalies = transactions
      .filter(t => t.amount > threshold)
      .map(t => ({
        _id:         t._id,
        amount:      t.amount,
        category:    t.category,
        description: t.description,
        date:        t.date,
      }));

    res.json({
      total,
      average: Math.round(average),
      count:   transactions.length,
      categories,
      anomalies,
    });

  } catch (err) {
    console.error('GET /insights error:', err.message);
    res.status(500).json({ message: 'Failed to fetch insights.' });
  }
});

module.exports = router;