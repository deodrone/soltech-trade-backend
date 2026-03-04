const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, unique: true },
  email: { type: String, unique: true, sparse: true },
  name: String,
  portfolio: [
    {
      symbol: String,
      amount: Number,
      avgBuyPrice: Number
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
