/**
 * liveFeeds.js — Real-time on-chain data relay
 *
 * Sources:
 *  1. Pump.fun WebSocket (wss://pumpportal.fun/api/data)
 *     → broadcasts new_token events to all frontend clients
 *  2. Helius Enhanced WebSocket
 *     → subscribes to Raydium AMM v4 program logs for new pool creation
 *     → broadcasts new_raydium_pool events to all frontend clients
 */

const WebSocket = require('ws');

// Raydium AMM v4 program ID
const RAYDIUM_AMM_V4 = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const PUMP_FUN_WS    = 'wss://pumpportal.fun/api/data';

let pumpWs      = null;
let heliusWs    = null;
let broadcastFn = null;
let running     = false;

// ── Pump.fun WebSocket ────────────────────────────────────────────────────────
function connectPump() {
  if (pumpWs) { try { pumpWs.terminate(); } catch {} }

  pumpWs = new WebSocket(PUMP_FUN_WS);

  pumpWs.on('open', () => {
    console.log(JSON.stringify({ event: 'pump_ws_connected' }));
    // Subscribe to new token creations
    pumpWs.send(JSON.stringify({ method: 'subscribeNewToken' }));
  });

  pumpWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // Pump.fun sends token creation events (has "mint" field)
      if (!msg.mint) return;

      const token = {
        mint: msg.mint,
        name: msg.name,
        symbol: msg.symbol,
        image: msg.image_uri || msg.imageUri || null,
        description: msg.description,
        createdAt: msg.created_timestamp || Date.now(),
        marketCap: msg.market_cap || 0,
        usdMarketCap: msg.usd_market_cap || msg.market_cap || 0,
        replies: msg.reply_count || 0,
        progress: Math.min(((msg.virtual_sol_reserves || 0) / 79_000_000_000) * 100, 100),
        complete: msg.complete || false,
        website: msg.website || null,
        twitter: msg.twitter || null,
        telegram: msg.telegram || null,
        creator: msg.creator || null,
        source: 'pump',
      };

      if (broadcastFn) broadcastFn({ type: 'new_token', data: token });
    } catch {}
  });

  pumpWs.on('close', () => {
    console.log(JSON.stringify({ event: 'pump_ws_closed', reconnecting: true }));
    if (running) setTimeout(connectPump, 5000);
  });

  pumpWs.on('error', (err) => {
    console.error(JSON.stringify({ event: 'pump_ws_error', error: err.message }));
    pumpWs.terminate();
  });
}

// ── Helius WebSocket (Raydium new pool detection) ─────────────────────────────
function connectHelius() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return;

  if (heliusWs) { try { heliusWs.terminate(); } catch {} }

  heliusWs = new WebSocket(`wss://atlas-mainnet.helius-rpc.com?api-key=${apiKey}`);

  let subId = null;

  heliusWs.on('open', () => {
    console.log(JSON.stringify({ event: 'helius_ws_connected' }));
    // Subscribe to logs that mention Raydium AMM v4 (new pool creation)
    heliusWs.send(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'logsSubscribe',
      params: [
        { mentions: [RAYDIUM_AMM_V4] },
        { commitment: 'confirmed' }
      ]
    }));
  });

  heliusWs.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // Subscription confirmation
      if (msg.id === 1 && msg.result !== undefined) {
        subId = msg.result;
        console.log(JSON.stringify({ event: 'helius_raydium_subscribed', subId }));
        return;
      }

      // Log notification — look for "initialize" (new pool creation signature)
      const params = msg.params;
      if (!params?.result) return;
      const { logs, signature, err } = params.result.value;
      if (err) return; // skip failed txs

      const isNewPool = logs?.some(l =>
        l.includes('initialize') ||
        l.includes('InitializeInstruction') ||
        l.includes('init_pc_amount')
      );
      if (!isNewPool) return;

      console.log(JSON.stringify({ event: 'raydium_new_pool', signature }));
      if (broadcastFn) {
        broadcastFn({ type: 'new_raydium_pool', data: { signature, ts: Date.now() } });
      }
    } catch {}
  });

  heliusWs.on('close', () => {
    console.log(JSON.stringify({ event: 'helius_ws_closed', reconnecting: true }));
    if (running) setTimeout(connectHelius, 8000);
  });

  heliusWs.on('error', (err) => {
    console.error(JSON.stringify({ event: 'helius_ws_error', error: err.message }));
    heliusWs.terminate();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
function start(broadcast) {
  if (running) return;
  running = true;
  broadcastFn = broadcast;
  connectPump();
  connectHelius();
  console.log(JSON.stringify({ event: 'live_feeds_started' }));
}

function stop() {
  running = false;
  broadcastFn = null;
  if (pumpWs)   { try { pumpWs.terminate();   } catch {} pumpWs   = null; }
  if (heliusWs) { try { heliusWs.terminate();  } catch {} heliusWs = null; }
  console.log(JSON.stringify({ event: 'live_feeds_stopped' }));
}

module.exports = { start, stop };
