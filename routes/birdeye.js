const express = require('express');
const axios = require('axios');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();

const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY;
const BASE = 'https://public-api.birdeye.so';
const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const birdeyeHeaders = () => ({ 'X-API-KEY': BIRDEYE_KEY, 'x-chain': 'solana' });

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
router.use(limiter);

// ── OHLCV candles ─────────────────────────────────────────────────────────────
router.get('/ohlcv', async (req, res) => {
  const { address, type = '1H', time_from, time_to } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  try {
    const { data } = await axios.get(`${BASE}/defi/ohlcv`, {
      headers: birdeyeHeaders(), params: { address, type, time_from, time_to }, timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Token overview ────────────────────────────────────────────────────────────
router.get('/token_overview', async (req, res) => {
  const { address } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  try {
    const { data } = await axios.get(`${BASE}/defi/token_overview`, {
      headers: birdeyeHeaders(), params: { address }, timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Top traders ───────────────────────────────────────────────────────────────
router.get('/token_top_traders', async (req, res) => {
  const { address, time_frame = '24h', sort_type = 'desc', sort_by = 'volume', limit = 20 } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  try {
    const { data } = await axios.get(`${BASE}/defi/v2/tokens/top_traders`, {
      headers: birdeyeHeaders(), params: { address, time_frame, sort_type, sort_by, limit: Math.min(parseInt(limit), 50) }, timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Token list (by volume) ────────────────────────────────────────────────────
router.get('/tokenlist', async (req, res) => {
  const { sort_by = 'v24hUSD', sort_type = 'desc', offset = 0, limit = 50 } = req.query;
  try {
    const { data } = await axios.get(`${BASE}/defi/tokenlist`, {
      headers: birdeyeHeaders(),
      params: { sort_by, sort_type, offset, limit: Math.min(parseInt(limit), 100) },
      timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Trending tokens ───────────────────────────────────────────────────────────
router.get('/trending_tokens/:chain', async (req, res) => {
  const { limit = 20 } = req.query;
  try {
    const { data } = await axios.get(`${BASE}/defi/token_trending`, {
      headers: birdeyeHeaders(), params: { limit: Math.min(parseInt(limit), 50) }, timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Recent token trades ───────────────────────────────────────────────────────
router.get('/trades', async (req, res) => {
  const { address, limit = 30 } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  try {
    const { data } = await axios.get(`${BASE}/defi/txs/token`, {
      headers: birdeyeHeaders(),
      params: { address, tx_type: 'swap', offset: 0, limit: Math.min(parseInt(limit), 50) },
      timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Wallet transaction list ───────────────────────────────────────────────────
router.get('/wallet_tx_list', async (req, res) => {
  const { wallet, limit = 50 } = req.query;
  if (!wallet || !SOLANA_ADDR.test(wallet)) return res.status(400).json({ error: 'Invalid wallet' });
  try {
    const { data } = await axios.get(`${BASE}/v1/wallet/tx_list`, {
      headers: birdeyeHeaders(),
      params: { wallet, limit: Math.min(parseInt(limit), 100) },
      timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

// ── Wallet token list ─────────────────────────────────────────────────────────
router.get('/v1/wallet/token_list', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet || !SOLANA_ADDR.test(wallet)) return res.status(400).json({ error: 'Invalid wallet' });
  try {
    const { data } = await axios.get(`${BASE}/v1/wallet/token_list`, {
      headers: birdeyeHeaders(), params: { wallet }, timeout: 10000,
    });
    res.json(data);
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.message }); }
});

module.exports = router;
