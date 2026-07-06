// LOCATION: backend/index.js
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [
    "https://spend-wise-eight-mu.vercel.app"  // deployed frontend
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

app.use(express.json());

// ── Routes ──
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/profile',      require('./routes/profile'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/insights',     require('./routes/insights'));
app.use('/api/coach',        require('./routes/coach'));
app.use('/api/goals',        require('./routes/goals'));
app.use('/api/budget',       require('./routes/budget'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => console.log(`🚀  Server → http://localhost:${PORT}`));
  })
  .catch(err => { console.error('❌  MongoDB failed:', err.message); process.exit(1); });
