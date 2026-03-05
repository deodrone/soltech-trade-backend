const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  wallet:    { type: String, required: true, index: true },
  txid:      { type: String, required: true, unique: true },
  paidSol:   { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  verified:  { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
