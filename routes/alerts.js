const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { verifyToken } = require('../middleware/auth');

const VALID_TYPES      = new Set(['price', 'wallet']);
const VALID_CONDITIONS = new Set(['above', 'below', 'change_up', 'change_down']);
const SOLANA_ADDR      = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// All routes require auth
router.use(verifyToken);

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user.uid }).sort({ createdAt: -1 }).limit(200);
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alerts
router.post('/', async (req, res) => {
  try {
    const { type, mint, wallet, condition, value } = req.body;

    if (!type || !VALID_TYPES.has(type)) {
      return res.status(400).json({ error: 'type must be "price" or "wallet"' });
    }
    if (type === 'price') {
      if (!mint || !SOLANA_ADDR.test(mint)) return res.status(400).json({ error: 'Invalid mint address' });
      if (!condition || !VALID_CONDITIONS.has(condition)) return res.status(400).json({ error: 'Invalid condition' });
      if (value == null || typeof value !== 'number' || value <= 0) return res.status(400).json({ error: 'value must be a positive number' });
    }
    if (type === 'wallet') {
      if (!wallet || !SOLANA_ADDR.test(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const alert = await Alert.create({
      userId: req.user.uid,
      type,
      mint:      type === 'price'  ? mint  : undefined,
      wallet:    type === 'wallet' ? wallet : undefined,
      condition: type === 'price'  ? condition : undefined,
      value:     type === 'price'  ? value : undefined,
    });
    res.status(201).json(alert);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/alerts/:id — toggle active only
router.patch('/:id', async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') return res.status(400).json({ error: 'active must be boolean' });
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { active },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Not found' });
    res.json(alert);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await Alert.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
