// LOCATION: backend/routes/budget.js
const express       = require('express');
const MonthlyBudget = require('../models/MonthlyBudget');
const Transaction   = require('../models/Transaction');
const auth          = require('../middleware/auth');

const router = express.Router();

// ── GET /api/budget/current ───────────────────────────────────
// Returns this month's budget + this month's transactions + spent total.
// If no budget has been set yet for this month, returns { budgetSet: false }.
router.get('/current', auth, async (req, res) => {
  try {
    const now   = new Date();
    const month = now.getMonth() + 1; // JS months are 0-indexed
    const year  = now.getFullYear();

    const budget = await MonthlyBudget.findOne({ user: req.user._id, month, year });

    // Start and end of current month
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);

    const transactions = await Transaction.find({
      user: req.user._id,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 });

    const spent = transactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      budgetSet:    !!budget,
      month,
      year,
      balance:      budget ? budget.balance : 0,
      spent,
      remaining:    budget ? budget.balance - spent : 0,
      transactions,
    });
  } catch (err) {
    console.error('GET /budget/current:', err.message);
    res.status(500).json({ message: 'Failed to fetch current budget.' });
  }
});

// ── POST /api/budget/current ──────────────────────────────────
// Set or update this month's budget balance.
// Uses upsert so calling it again just updates the balance.
router.post('/current', auth, async (req, res) => {
  try {
    const { balance } = req.body;
    const parsed = parseFloat(balance);

    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ message: 'Balance must be a positive number.' });
    }

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const budget = await MonthlyBudget.findOneAndUpdate(
      { user: req.user._id, month, year },
      { $set: { balance: parsed } },
      { upsert: true, new: true, runValidators: true }
    );

    console.log(`✅ Budget set: ${parsed} for ${year}-${month} (user ${req.user._id})`);
    res.json({ month, year, balance: budget.balance });
  } catch (err) {
    console.error('POST /budget/current:', err.message);
    res.status(500).json({ message: 'Failed to save budget.' });
  }
});

// ── GET /api/budget/history ───────────────────────────────────
// Returns all past months (not including the current month) with their
// budget and transactions grouped by month/year.
router.get('/history', auth, async (req, res) => {
  try {
    const now          = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();

    // Get all budgets for this user, sorted newest first
    const budgets = await MonthlyBudget.find({ user: req.user._id })
      .sort({ year: -1, month: -1 });

    // Get all transactions older than this month
    const historyStart = new Date(currentYear, currentMonth - 1, 1);
    const allTx = await Transaction.find({
      user: req.user._id,
      date: { $lt: historyStart },
    }).sort({ date: -1 });

    // Group transactions by year-month key
    const txByMonth = {};
    allTx.forEach(t => {
      const d   = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!txByMonth[key]) txByMonth[key] = [];
      txByMonth[key].push(t);
    });

    // Build history array — one entry per month that has either a budget or transactions
    const monthKeys = new Set([
      ...budgets
        .filter(b => !(b.month === currentMonth && b.year === currentYear))
        .map(b => `${b.year}-${b.month}`),
      ...Object.keys(txByMonth),
    ]);

    const history = Array.from(monthKeys).map(key => {
      const [yr, mo] = key.split('-').map(Number);
      const budget   = budgets.find(b => b.year === yr && b.month === mo);
      const txs      = txByMonth[key] || [];
      const spent    = txs.reduce((sum, t) => sum + t.amount, 0);
      return {
        month:        mo,
        year:         yr,
        balance:      budget ? budget.balance : 0,
        budgetSet:    !!budget,
        spent,
        remaining:    budget ? budget.balance - spent : 0,
        transactions: txs,
      };
    }).sort((a, b) => b.year - a.year || b.month - a.month);

    res.json(history);
  } catch (err) {
    console.error('GET /budget/history:', err.message);
    res.status(500).json({ message: 'Failed to fetch history.' });
  }
});

module.exports = router;