const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  symbol: { type: String, required: true },
  type: { type: String, enum: ['buy', 'sell', 'sl_tp', 'limit'], required: true },
  amount: { type: Number, required: true },
  price: { type: Number, default: 0 },
  stopLossPrice:   { type: Number, default: null },
  takeProfitPrice: { type: Number, default: null },
  status: { type: String, enum: ['open', 'filled', 'cancelled'], default: 'open' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
