const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { verifyToken } = require('../middleware/auth');

// All routes require auth
router.use(verifyToken);

// GET /api/alerts — list user's alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/alerts — create alert
router.post('/', async (req, res) => {
  try {
    const { type, mint, wallet, condition, value } = req.body;
    const alert = await Alert.create({ userId: req.user.uid, type, mint, wallet, condition, value });
    res.status(201).json(alert);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/alerts/:id — update (toggle active)
router.patch('/:id', async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      req.body,
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Not found' });
    res.json(alert);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    await Alert.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
