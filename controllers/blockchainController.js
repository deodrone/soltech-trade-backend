const axios = require('axios');

const HELIUS_API = `https://api.helius.xyz/v0`;
const HELIUS_KEY = process.env.HELIUS_API_KEY;
const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// GET /api/blockchain/tokens?address=<wallet>
exports.getTokenBalances = async (req, res) => {
  const { address } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana address' });
  }
  try {
    const { data } = await axios.get(
      `${HELIUS_API}/addresses/${address}/balances?api-key=${HELIUS_KEY}`,
      { timeout: 15000 }
    );
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
};

// GET /api/blockchain/transactions?address=<wallet>&limit=50
exports.getTransactions = async (req, res) => {
  const { address, limit = 50 } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana address' });
  }
  try {
    const { data } = await axios.get(
      `${HELIUS_API}/addresses/${address}/transactions?api-key=${HELIUS_KEY}&limit=${Math.min(parseInt(limit), 100)}`,
      { timeout: 15000 }
    );
    res.json(data);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
};

// GET /api/blockchain/nfts?address=<wallet>  (Helius DAS)
exports.getNFTs = async (req, res) => {
  const { address } = req.query;
  if (!address || !SOLANA_ADDR.test(address)) {
    return res.status(400).json({ error: 'Invalid Solana address' });
  }
  try {
    const { data } = await axios.post(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
      { jsonrpc: '2.0', id: 1, method: 'getAssetsByOwner', params: { ownerAddress: address, page: 1, limit: 100 } },
      { timeout: 15000 }
    );
    res.json(data.result || []);
  } catch (e) {
    res.status(e.response?.status || 500).json({ error: e.message });
  }
};
