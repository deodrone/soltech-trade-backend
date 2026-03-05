const express = require('express');
const axios = require('axios');
const router = express.Router();

const HELIUS_KEY = process.env.HELIUS_API_KEY;
const HELIUS_API = `https://api.helius.xyz/v0`;
const JUPITER_PRICE = 'https://api.jup.ag/price/v2';

const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// GET /api/portfolio/:wallet
router.get('/:wallet', async (req, res) => {
  const { wallet } = req.params;
  if (!SOLANA_ADDR.test(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
  try {

    // Get token balances via Helius
    const { data: balances } = await axios.get(
      `${HELIUS_API}/addresses/${wallet}/balances?api-key=${HELIUS_KEY}`,
      { timeout: 15000 }
    );

    const tokens = balances.tokens || [];
    const mints = tokens.map(t => t.mint).filter(Boolean);

    // Batch price from Jupiter
    let prices = {};
    if (mints.length > 0) {
      const chunks = chunkArray(mints, 100);
      for (const chunk of chunks) {
        const { data: pd } = await axios.get(`${JUPITER_PRICE}?ids=${chunk.join(',')}`, { timeout: 10000 });
        prices = { ...prices, ...(pd.data || {}) };
      }
    }

    // Enrich holdings
    const holdings = tokens.map(t => {
      const priceInfo = prices[t.mint];
      const priceUsd = priceInfo?.price || 0;
      const balance = t.amount || 0;
      const humanBalance = balance / Math.pow(10, t.decimals || 6);
      const valueUsd = humanBalance * priceUsd;
      return { ...t, priceUsd, valueUsd, humanBalance };
    }).filter(t => t.valueUsd > 0.01 || t.humanBalance > 0);

    // SOL balance
    const solBalance = (balances.nativeBalance || 0) / 1e9;
    const { data: solPrice } = await axios.get(`${JUPITER_PRICE}?ids=So11111111111111111111111111111111111111112`, { timeout: 5000 });
    const solUsd = solPrice.data?.['So11111111111111111111111111111111111111112']?.price || 0;

    const totalUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0) + (solBalance * solUsd);

    res.json({ holdings, solBalance, solUsd, totalUsd });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

module.exports = router;
