// LOCATION: backend/routes/auth.js
const express              = require('express');
const jwt                  = require('jsonwebtoken');
const { OAuth2Client }     = require('google-auth-library');
const User                 = require('../models/User');
const { sendWelcomeEmail } = require('../services/mailer');

const router = express.Router();

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

router.get('/google/client-id', (_req, res) => {
  res.json({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    configured: Boolean(process.env.GOOGLE_CLIENT_ID),
  });
});

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'An account with this email already exists.' });

    const user  = await User.create({ name, email, password });
    const token = generateToken(user._id);

    // Welcome email — fire and forget, never blocks the response
    sendWelcomeEmail(email, name);

    res.status(201).json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Incorrect email or password.' });

    const token = generateToken(user._id);
    res.json({ token, user: user.toPublic() });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/google ────────────────────────────────────
// Verifies the Google credential (ID token) sent from the frontend
// after the user completes the Google sign-in popup.
// Sends a welcome email only on FIRST sign-up, not on subsequent logins.
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential)
      return res.status(400).json({ message: 'Google credential is missing.' });

    if (!process.env.GOOGLE_CLIENT_ID)
      return res.status(500).json({ message: 'Google sign-in is not configured on the server.' });

    // Verify the ID token with Google
    const client  = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket  = await client.verifyIdToken({
      idToken:  credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { sub: googleId, email, name, picture } = payload;

    if (!email)
      return res.status(400).json({ message: 'Could not retrieve email from Google.' });

    // Find existing user by Google ID or email
    let user    = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNew   = false;

    if (!user) {
      // Brand new user — create account
      user  = await User.create({ name, email, googleId, picture });
      isNew = true;
    } else if (!user.googleId) {
      // Existing email/password user — link their Google account
      await require('mongoose').connection.collection('users').updateOne(
        { _id: user._id },
        { $set: { googleId, picture } }
      );
    }

    const token = generateToken(user._id);

    // Send welcome email only to brand-new users
    if (isNew) {
      sendWelcomeEmail(email, name || email.split('@')[0]);
    }

    res.json({ token, user: user.toPublic(), isNew });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
});

module.exports = router;
