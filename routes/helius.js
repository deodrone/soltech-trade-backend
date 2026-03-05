const express = require('express');
const axios = require('axios');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();

const HELIUS_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;

// Solana base58 address validation (32–44 chars, alphanumeric no 0/O/I/l)
const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Allowed JSON-RPC methods to prevent arbitrary RPC abuse
const ALLOWED_METHODS = new Set([
  // Asset / account reads
  'getAssetsByOwner', 'getAsset', 'getAssetBatch',
  'getTransaction', 'getBalance', 'getTokenAccountsByOwner',
  'getParsedTokenAccountsByOwner', 'getAccountInfo',
  'getTokenLargestAccounts', 'getTokenSupply',
  // Transaction lifecycle (needed by @solana/web3.js Connection)
  'getLatestBlockhash', 'sendTransaction', 'getSignatureStatuses',
  'getBlockHeight', 'getSlot',
]);

const heliusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

router.use(heliusLimiter);

// Proxy JSON-RPC calls (allowlisted methods only)
router.post('/', async (req, res) => {
  const { method } = req.body;
  if (!method || !ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ error: 'RPC method not allowed' });
  }
  try {
    const { data } = await axios.post(HELIUS_RPC, req.body, { timeout: 15000 });
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// Proxy transaction history
router.get('/txs/:address', async (req, res) => {
  const { address } = req.params;
  if (!SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const before = req.query.before;
  if (before && !/^[A-Za-z0-9]{43,88}$/.test(before)) return res.status(400).json({ error: 'Invalid cursor' });
  try {
    const url = `${HELIUS_API}/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=${limit}${before ? `&before=${before}` : ''}`;
    const { data } = await axios.get(url, { timeout: 15000 });
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// Proxy token accounts
router.get('/tokens/:address', async (req, res) => {
  const { address } = req.params;
  if (!SOLANA_ADDR.test(address)) return res.status(400).json({ error: 'Invalid address' });
  try {
    const url = `${HELIUS_API}/addresses/${address}/balances?api-key=${HELIUS_KEY}`;
    const { data } = await axios.get(url, { timeout: 15000 });
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

// Proxy parsed transactions (enriched — used for portfolio TX details)
router.post('/parsed-transactions', async (req, res) => {
  const { signatures } = req.body;
  if (!Array.isArray(signatures) || signatures.length === 0) {
    return res.status(400).json({ error: 'signatures array required' });
  }
  const safe = signatures.slice(0, 100).filter(s => typeof s === 'string' && /^[A-Za-z0-9]{43,88}$/.test(s));
  if (!safe.length) return res.status(400).json({ error: 'No valid signatures' });
  try {
    const url = `${HELIUS_API}/transactions?api-key=${HELIUS_KEY}`;
    const { data } = await axios.post(url, { transactions: safe }, { timeout: 15000 });
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
});

module.exports = router;
