// LOCATION: backend/models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: {
    type: String,
    required: function () { return !this.googleId; },
  },
  googleId: { type: String },
  picture:  { type: String },
  currency: { type: String, default: 'NGN', uppercase: true, trim: true },
  currentBalance: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Verify password
UserSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password || '');
};

// Safe public object — never expose password
UserSchema.methods.toPublic = function () {
  return {
    id:             this._id,
    _id:            this._id,
    name:           this.name,
    email:          this.email,
    picture:        this.picture || null,
    currency:       this.currency || 'NGN',
    currentBalance: this.currentBalance ?? 0,
  };
};

module.exports = mongoose.model('User', UserSchema);
