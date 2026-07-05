// LOCATION: backend/routes/coach.js
const express       = require('express');
const Transaction   = require('../models/Transaction');
const MonthlyBudget = require('../models/MonthlyBudget');
const User          = require('../models/User');
const auth          = require('../middleware/auth');
const askAI         = require('../services/ai');

const router = express.Router();

const SYMBOL_MAP = {
  NGN:'₦', USD:'$',  GBP:'£',  EUR:'€',  GHS:'₵',
  KES:'KSh',ZAR:'R', CAD:'CA$',AUD:'A$', JPY:'¥',
  CNY:'¥',  INR:'₹', BRL:'R$', MXN:'MX$',AED:'AED',
  SAR:'SAR',EGP:'EGP',TZS:'TSh',UGX:'USh',RWF:'RWF',
};

function sym(code) { return SYMBOL_MAP[code] || code; }

router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required.' });

    const user = await User.findById(req.user._id);
    const currency = user.currency || 'NGN';
    const s = sym(currency);

    // ── Get this month's budget ────────────────────────────────
    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const monthlyBudget = await MonthlyBudget.findOne({ user: user._id, month, year });

    // ── Get this month's transactions only ────────────────────
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59, 999);

    const transactions = await Transaction.find({
      user: user._id,
      date: { $gte: start, $lte: end },
    });

    const total = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Category breakdown
    const cats = {};
    transactions.forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
    const catText = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `${c}: ${s}${v.toLocaleString()}`)
      .join(', ') || 'No spending this month yet.';

    // Budget context
    let budgetContext;
    if (monthlyBudget) {
      const balance   = monthlyBudget.balance;
      const remaining = balance - total;
      const pct       = balance > 0 ? ((total / balance) * 100).toFixed(1) : 0;
      budgetContext = `Monthly budget: ${s}${balance.toLocaleString()}.
Total spent this month: ${s}${total.toLocaleString()}.
Remaining: ${s}${Math.max(0, remaining).toLocaleString()}.
${pct}% of monthly budget used.
${remaining < 0 ? `⚠ OVER budget by ${s}${Math.abs(remaining).toLocaleString()}.` : ''}`;
    } else {
      budgetContext = `No monthly budget set yet. Total spent this month: ${s}${total.toLocaleString()}.`;
    }

    const prompt = `You are SpendWise AI, a personal finance coach embedded in a spending tracker app.

User: ${user.name}
Month: ${new Date().toLocaleString('default', { month: 'long' })} ${year}
Currency: ${currency} (${s})

${budgetContext}

Spending breakdown this month: ${catText}
Transactions this month: ${transactions.length}

The user asks: "${message}"

Instructions:
- Use ${s} (${currency}) for all amounts — never raw numbers without a symbol
- Reference the user's actual numbers specifically
- If they are over budget or close (>80%), warn them clearly but constructively
- Be warm, direct, and practical — 3 to 5 sentences unless the user asks for more detail
- No markdown, no bullet points, just natural conversational text`;

    const reply = await askAI(prompt);
    res.json({ reply });

  } catch (err) {
    console.error('POST /coach error:', err.message);
    res.status(500).json({ message: 'AI coach unavailable. Please try again.' });
  }
});

module.exports = router;