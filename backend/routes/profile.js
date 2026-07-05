// LOCATION: backend/routes/profile.js
const express              = require('express');
const User                 = require('../models/User');
const auth                 = require('../middleware/auth');
const router = express.Router();

let checkAndResetMonth = async () => ({ reset: false });

try {
  const monthlyReset = require('../services/monthlyReset');
  if (monthlyReset && typeof monthlyReset.checkAndResetMonth === 'function') {
    checkAndResetMonth = monthlyReset.checkAndResetMonth;
  }
} catch (err) {
  console.warn('monthlyReset service not found, skipping monthly reset checks.');
}

function toPublic(user) {
  return {
    id:             user._id,
    _id:            user._id,
    name:           user.name,
    email:          user.email,
    picture:        user.picture || null,
    currency:       user.currency       || 'NGN',
    currentBalance: user.currentBalance ?? 0,
    balanceMonth:   user.balanceMonth   || '',
  };
}

// GET /api/profile
// Also triggers the monthly reset check — so it runs on every login/reload.
router.get('/', auth, async (req, res) => {
  try {
    let user = await User.findById(req.user._id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Check if a new month has started; archive old data if so
    const result = await checkAndResetMonth(user);

    // If the month rolled over, re-fetch user so currentBalance = 0
    if (result.reset) {
      user = await User.findById(req.user._id).select('-password').lean();
    }

    res.json({ ...toPublic(user), monthReset: result.reset });
  } catch (err) {
    console.error('GET /profile:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
});

// PATCH /api/profile
router.patch('/', auth, async (req, res) => {
  try {
    const { currency, currentBalance } = req.body;
    const updates = {};

    if (currency != null && currency !== '') {
      updates.currency = String(currency).toUpperCase().trim();
    }
    if (currentBalance != null && currentBalance !== '') {
      const n = parseFloat(currentBalance);
      if (isNaN(n) || n < 0) return res.status(400).json({ message: 'Balance must be a positive number.' });
      updates.currentBalance = n;

      // Stamp the current month so we know which period this balance belongs to
      const d = new Date();
      updates.balanceMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Nothing to update.' });

    const updated = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $set: updates },
      { new: true, runValidators: false, select: '-password', lean: true }
    );

    if (!updated) return res.status(404).json({ message: 'User not found.' });

    console.log(`Profile saved: balance=${updated.currentBalance} currency=${updated.currency} month=${updated.balanceMonth || ''}`);
    res.json(toPublic(updated));
  } catch (err) {
    console.error('PATCH /profile:', err.message);
    res.status(500).json({ message: 'Failed to update: ' + err.message });
  }
});

module.exports = router;