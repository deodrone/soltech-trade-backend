const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId:    { type: String, required: false }, // Firebase UID — optional for legacy rows
  wallet:    { type: String, required: true },
  txid:      { type: String, required: true, unique: true },
  paidSol:   { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  verified:  { type: Boolean, default: false },
}, { timestamps: true });

subscriptionSchema.index({ wallet: 1, expiresAt: -1 });
subscriptionSchema.index({ userId: 1, expiresAt: -1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
