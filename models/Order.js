const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  symbol: { type: String, required: true },
  type:   { type: String, enum: ['buy', 'sell', 'sl_tp', 'limit'], required: true },
  amount: { type: Number, required: true },
  price:           { type: Number, default: 0 },
  stopLossPrice:   { type: Number, default: null },
  takeProfitPrice: { type: Number, default: null },
  status: { type: String, enum: ['open', 'filled', 'cancelled'], default: 'open' },
}, { timestamps: true });

// Queries: user's recent orders, user's open SL/TP orders
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, type: 1, status: 1 });
// alertChecker/SL-TP executor: find all open sl_tp orders
orderSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
