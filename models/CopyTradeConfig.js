const mongoose = require('mongoose');

const CopyTradeConfigSchema = new mongoose.Schema({
  userId:        { type: String, required: true, index: true },
  sourceWallet:  { type: String, required: true },
  label:         { type: String, default: '' },
  slippage:      { type: Number, default: 1.0 },
  maxSol:        { type: Number, default: 0.5 },
  tokens:        [String],    // whitelist; empty = all tokens
  active:        { type: Boolean, default: true },
}, { timestamps: true });

CopyTradeConfigSchema.index({ userId: 1, active: 1 });

module.exports = mongoose.model('CopyTradeConfig', CopyTradeConfigSchema);
