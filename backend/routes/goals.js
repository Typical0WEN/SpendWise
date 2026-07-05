// LOCATION: backend/routes/goals.js
const express = require('express');
const Goal    = require('../models/Goal');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── GET /api/goals — get all goals for this user ──
router.get('/', auth, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error('GET /goals error:', err.message);
    res.status(500).json({ message: 'Failed to fetch goals.' });
  }
});

// ── POST /api/goals — create a new goal ──
router.post('/', auth, async (req, res) => {
  try {
    const { title, targetAmount, currentAmount, deadline } = req.body;

    if (!title || !targetAmount) {
      return res.status(400).json({ message: 'Title and target amount are required.' });
    }

    const goal = await Goal.create({
      user: req.user._id,
      title,
      targetAmount:  parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount) || 0,
      deadline:      deadline ? new Date(deadline) : undefined,
    });

    res.status(201).json(goal);
  } catch (err) {
    console.error('POST /goals error:', err.message);
    res.status(500).json({ message: 'Failed to create goal.' });
  }
});

// ── PATCH /api/goals/:id — update progress on a goal ──
router.patch('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found.' });
    }
    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised.' });
    }

    const { currentAmount } = req.body;
    if (currentAmount !== undefined) {
      goal.currentAmount = parseFloat(currentAmount);
    }

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error('PATCH /goals error:', err.message);
    res.status(500).json({ message: 'Failed to update goal.' });
  }
});

// ── DELETE /api/goals/:id — delete a goal ──
router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found.' });
    }
    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorised.' });
    }

    await goal.deleteOne();
    res.json({ message: 'Goal deleted.' });
  } catch (err) {
    console.error('DELETE /goals error:', err.message);
    res.status(500).json({ message: 'Failed to delete goal.' });
  }
});

module.exports = router;