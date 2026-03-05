const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  userId:   { type: String, required: true, unique: true, index: true },
  visits:   { type: Number, default: 0 },
  signups:  { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Referral', ReferralSchema);
