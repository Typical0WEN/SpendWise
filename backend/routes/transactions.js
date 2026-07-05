// LOCATION: backend/routes/transactions.js
const express     = require('express');
const Transaction = require('../models/Transaction');
const auth        = require('../middleware/auth');

const router = express.Router();

// All routes below are protected — user must be logged in

// ── GET /api/transactions — get all transactions for this user ──
router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction
      .find({ user: req.user._id })
      .sort({ date: -1 })
      .limit(500);

    res.json(transactions);

  } catch (err) {
    console.error('GET /transactions error:', err.message);
    res.status(500).json({ message: 'Failed to fetch transactions.' });
  }
});

// ── POST /api/transactions — add a new transaction ──
router.post('/', auth, async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;

    if (!amount || !category) {
      return res.status(400).json({ message: 'Amount and category are required.' });
    }

    const transaction = await Transaction.create({
      user:        req.user._id,
      amount:      parseFloat(amount),
      category,
      description: description || '',
      date:        date ? new Date(date) : new Date(),
    });

    res.status(201).json(transaction);

  } catch (err) {
    console.error('POST /transactions error:', err.message);
    res.status(500).json({ message: 'Failed to save transaction.' });
  }
});

// ── DELETE /api/transactions/:id — delete one transaction ──
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    // Ensure the transaction belongs to the requesting user
    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised to delete this transaction.' });
    }

    await transaction.deleteOne();
    res.json({ message: 'Transaction deleted.' });

  } catch (err) {
    console.error('DELETE /transactions error:', err.message);
    res.status(500).json({ message: 'Failed to delete transaction.' });
  }
});

module.exports = router;