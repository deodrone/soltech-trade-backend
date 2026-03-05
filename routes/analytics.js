const express = require('express');
const router  = express.Router();
const WatchedWallet = require('../models/WatchedWallet');
const { verifyToken } = require('../middleware/auth');

const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

router.use(verifyToken);

// GET /api/analytics/watch  — list user's watched wallets
router.get('/watch', async (req, res) => {
  try {
    const wallets = await WatchedWallet.find({ userId: req.user.uid }).sort('-createdAt');
    res.json(wallets);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/analytics/watch  — add a wallet to watchlist
router.post('/watch', async (req, res) => {
  const { walletAddress, label = '' } = req.body;
  if (!walletAddress || !SOLANA_ADDR.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  try {
    const wallet = await WatchedWallet.findOneAndUpdate(
      { userId: req.user.uid, walletAddress },
      { $setOnInsert: { userId: req.user.uid, walletAddress, label: String(label).slice(0, 80) } },
      { upsert: true, new: true }
    );
    res.status(201).json(wallet);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Already watching this wallet' });
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/analytics/watch/:address  — remove a wallet from watchlist
router.delete('/watch/:address', async (req, res) => {
  const { address } = req.params;
  if (!SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  try {
    await WatchedWallet.findOneAndDelete({ userId: req.user.uid, walletAddress: address });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
