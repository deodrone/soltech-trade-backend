const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// POST /api/launchpad/create
// Frontend builds and signs the tx; this endpoint provides metadata storage + validation
router.post('/create', async (req, res) => {
  try {
    const { name, symbol, description, supply, decimals, logoUrl, curveType, initialPrice, migrationThreshold } = req.body;

    if (!name || !symbol || !supply) {
      return res.status(400).json({ error: 'name, symbol, and supply are required' });
    }

    // In production: call Raydium LaunchLab SDK server-side or return instructions for frontend to sign
    // For now return a mock response so frontend can test the flow
    res.json({
      ok: true,
      message: 'Token creation data validated. Sign the transaction with your wallet.',
      params: { name, symbol, description, supply, decimals: decimals || 6, logoUrl, curveType, initialPrice, migrationThreshold },
      // txid would come from on-chain execution
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
