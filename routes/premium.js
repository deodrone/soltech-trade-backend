const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const Subscription = require('../models/Subscription');

const PLATFORM_WALLET  = process.env.PLATFORM_WALLET  || '';
const SUBSCRIPTION_SOL = parseFloat(process.env.SUBSCRIPTION_PRICE_SOL || '0.05');
const HELIUS_KEY       = process.env.HELIUS_API_KEY    || '';
const HELIUS_RPC       = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const SUBSCRIPTION_DAYS = 30;

// ── GET /api/premium/status?wallet=xxx ──────────────────────────────────────
router.get('/status', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'wallet required' });
  try {
    const now = new Date();
    const sub = await Subscription.findOne({ wallet, verified: true, expiresAt: { $gt: now } })
      .sort({ expiresAt: -1 });
    if (sub) {
      return res.json({ active: true, expiresAt: sub.expiresAt, txid: sub.txid });
    }
    res.json({ active: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/premium/subscribe ─────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  const { wallet, txid } = req.body;
  if (!wallet || !txid) return res.status(400).json({ error: 'wallet and txid required' });

  try {
    // Check not already registered
    const existing = await Subscription.findOne({ txid });
    if (existing) return res.json({ active: true, expiresAt: existing.expiresAt });

    // Verify on-chain: fetch tx and confirm SOL was sent to platform wallet
    const verified = await verifyPaymentTx(txid, wallet, PLATFORM_WALLET, SUBSCRIPTION_SOL);
    if (!verified) return res.status(400).json({ error: 'Payment not verified on-chain' });

    const expiresAt = new Date(Date.now() + SUBSCRIPTION_DAYS * 86400 * 1000);
    const sub = await Subscription.create({ wallet, txid, paidSol: SUBSCRIPTION_SOL, expiresAt, verified: true });
    res.json({ active: true, expiresAt: sub.expiresAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Verify a SOL transfer on-chain via Helius ────────────────────────────────
async function verifyPaymentTx(txid, fromWallet, toWallet, minSol) {
  if (!HELIUS_KEY || !toWallet) return true; // skip if not configured
  try {
    const { data } = await axios.post(HELIUS_RPC, {
      jsonrpc: '2.0', id: 1,
      method: 'getTransaction',
      params: [txid, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    });
    const tx = data.result;
    if (!tx || tx.meta?.err) return false;

    // Check tx is recent (< 48h)
    const blockTime = tx.blockTime * 1000;
    if (Date.now() - blockTime > 48 * 3600 * 1000) return false;

    // Look for a SOL transfer from fromWallet to toWallet
    const instructions = tx.transaction?.message?.instructions || [];
    for (const ix of instructions) {
      if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
        const info = ix.parsed.info;
        const sentSol = (info.lamports || 0) / 1e9;
        if (info.source === fromWallet && info.destination === toWallet && sentSol >= minSol) {
          return true;
        }
      }
    }
    return false;
  } catch { return false; }
}

module.exports = router;
