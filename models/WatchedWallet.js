const mongoose = require('mongoose');

const WatchedWalletSchema = new mongoose.Schema({
  userId:        { type: String, required: true, index: true },
  walletAddress: { type: String, required: true },
  label:         { type: String, default: '' },
  copyEnabled:   { type: Boolean, default: false },
  copySettings:  {
    maxSol:    { type: Number, default: 0.5 },
    slippage:  { type: Number, default: 1.0 },
    tokens:    [String],
  },
}, { timestamps: true });

module.exports = mongoose.model('WatchedWallet', WatchedWalletSchema);
