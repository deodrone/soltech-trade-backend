const mongoose = require('mongoose');

const chartDataSchema = new mongoose.Schema({
  symbol: { type: String, required: true, default: 'ETH/USD' },
  timestamps: [Date],
  prices: [Number]
}, { timestamps: true });

module.exports = mongoose.model('ChartData', chartDataSchema);
