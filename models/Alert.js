const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  type:      { type: String, enum: ['price', 'wallet'], required: true },
  mint:      { type: String },
  wallet:    { type: String },
  condition: { type: String, enum: ['above', 'below', 'change_up', 'change_down'] },
  value:     { type: Number },
  active:    { type: Boolean, default: true },
  lastTriggered: { type: Date },
}, { timestamps: true });

// User's alerts list
AlertSchema.index({ userId: 1, createdAt: -1 });
// alertChecker: find all active price alerts with a mint (hot path — runs every 30s)
AlertSchema.index({ type: 1, active: 1, mint: 1 });

module.exports = mongoose.model('Alert', AlertSchema);
