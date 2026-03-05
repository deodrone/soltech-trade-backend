const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  type:      { type: String, enum: ['price', 'wallet'], required: true },
  mint:      { type: String },          // for price alerts
  wallet:    { type: String },          // for wallet alerts
  condition: { type: String, enum: ['above', 'below', 'change_up', 'change_down'] },
  value:     { type: Number },
  active:    { type: Boolean, default: true },
  lastTriggered: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Alert', AlertSchema);
