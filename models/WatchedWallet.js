const mongoose = require('mongoose');

const WatchedWalletSchema = new mongoose.Schema({
  userId:        { type: String, required: true },
  walletAddress: { type: String, required: true },
  label:         { type: String, default: '' },
  copyEnabled:   { type: Boolean, default: false },
  copySettings:  {
    maxSol:    { type: Number, default: 0.5 },
    slippage:  { type: Number, default: 1.0 },
    tokens:    [String],
  },
}, { timestamps: true });

// User's watchlist (sorted by date)
WatchedWalletSchema.index({ userId: 1, createdAt: -1 });
// Prevent duplicate wallet entries per user
WatchedWalletSchema.index({ userId: 1, walletAddress: 1 }, { unique: true });

module.exports = mongoose.model('WatchedWallet', WatchedWalletSchema);
