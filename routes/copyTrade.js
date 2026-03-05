const express = require('express');
const router = express.Router();
const CopyTradeConfig = require('../models/CopyTradeConfig');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/copy-trade
router.get('/', async (req, res) => {
  try {
    const copies = await CopyTradeConfig.find({ userId: req.user.uid });
    res.json(copies);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/copy-trade
router.post('/', async (req, res) => {
  try {
    const { sourceWallet, label, slippage, maxSol, tokens } = req.body;
    const config = await CopyTradeConfig.create({
      userId: req.user.uid, sourceWallet, label, slippage, maxSol, tokens: tokens || [], active: true
    });
    res.status(201).json(config);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/copy-trade/:id
router.patch('/:id', async (req, res) => {
  try {
    const { label, slippage, maxSol, tokens, active } = req.body;
    const update = {};
    if (label !== undefined)    update.label    = String(label).slice(0, 100);
    if (slippage !== undefined)  update.slippage  = Math.min(Math.max(parseFloat(slippage) || 1, 0.1), 50);
    if (maxSol !== undefined)    update.maxSol    = Math.min(Math.max(parseFloat(maxSol) || 0.1, 0.001), 100);
    if (Array.isArray(tokens))   update.tokens    = tokens.slice(0, 50);
    if (active !== undefined)    update.active    = Boolean(active);
    const config = await CopyTradeConfig.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      update,
      { new: true }
    );
    if (!config) return res.status(404).json({ error: 'Not found' });
    res.json(config);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/copy-trade/:id
router.delete('/:id', async (req, res) => {
  try {
    await CopyTradeConfig.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
