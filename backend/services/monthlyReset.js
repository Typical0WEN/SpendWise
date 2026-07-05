// LOCATION: backend/services/monthlyReset.js
// Checks on every profile fetch whether a new month has started.
// If so, resets user.currentBalance to 0 and stamps the new month.
// History is handled separately by MonthlyBudget + budget.js.
// Uses mongoose.connection directly — no model dependencies that can fail on load.

const mongoose = require('mongoose');

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function checkAndResetMonth(user) {
  const now = currentMonthStr();

  // Brand new user — just stamp the current month, no reset needed
  if (!user.balanceMonth) {
    await mongoose.connection.collection('users').updateOne(
      { _id: user._id },
      { $set: { balanceMonth: now } }
    );
    return { reset: false };
  }

  // Same month — nothing to do
  if (user.balanceMonth === now) {
    return { reset: false };
  }

  // New month started — clear balance and stamp new month
  await mongoose.connection.collection('users').updateOne(
    { _id: user._id },
    { $set: { currentBalance: 0, balanceMonth: now } }
  );

  console.log(`📅 Month rolled over (${user.balanceMonth} → ${now})`);
  return { reset: true };
}

module.exports = { checkAndResetMonth };