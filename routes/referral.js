const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const Referral = require('../models/Referral');
const User = require('../models/User');
const router = express.Router();

const visitLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Record a referral visit (public — called on any ?ref= page load)
router.post('/visit', visitLimiter, async (req, res) => {
  const { ref } = req.body;
  if (!ref || typeof ref !== 'string' || !/^[a-zA-Z0-9_-]{3,32}$/.test(ref)) {
    return res.status(400).json({ error: 'Invalid ref' });
  }
  await Referral.findOneAndUpdate({ userId: ref }, { $inc: { visits: 1 } }, { upsert: true });
  res.json({ ok: true });
});

// Get my referral stats (auth required)
router.get('/stats', verifyToken, async (req, res) => {
  const uid = req.user.uid;
  const doc = await Referral.findOne({ userId: uid });
  res.json({ visits: doc?.visits || 0, signups: doc?.signups || 0 });
});

module.exports = router;
