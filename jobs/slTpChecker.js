/**
 * SL/TP Order Checker
 * Polls open sl_tp orders every 30s, fetches current price via Jupiter,
 * and marks orders as filled (+ notifies user) when SL or TP is triggered.
 *
 * Note: This checker marks the order as "filled" and sends a WS notification.
 * Actual on-chain execution must be done by the user's client upon receiving
 * the notification (the backend doesn't hold wallet signing keys).
 */
const axios = require('axios');
const Order = require('../models/Order');

const JUPITER_PRICE      = 'https://api.jup.ag/price/v2';
const CHECK_INTERVAL_MS  = 30 * 1000;
const BATCH_SIZE         = 100; // Jupiter supports up to 100 mints per call

let pushToUser = null;
let timer      = null;

async function fetchPrices(mints) {
  if (!mints.length) return {};
  try {
    const { data } = await axios.get(`${JUPITER_PRICE}?ids=${mints.join(',')}`, { timeout: 10000 });
    return data.data || {};
  } catch {
    return {};
  }
}

async function runCheck() {
  try {
    const orders = await Order.find({ type: 'sl_tp', status: 'open' });
    if (!orders.length) return;

    // Dedupe mints (stored in `symbol` field)
    const mints = [...new Set(orders.map(o => o.symbol).filter(Boolean))];

    // Fetch in batches of 100
    let prices = {};
    for (let i = 0; i < mints.length; i += BATCH_SIZE) {
      const chunk = mints.slice(i, i + BATCH_SIZE);
      const batch = await fetchPrices(chunk);
      prices = { ...prices, ...batch };
    }

    const triggered = [];

    for (const order of orders) {
      const priceInfo = prices[order.symbol];
      if (!priceInfo) continue;

      const price = parseFloat(priceInfo.price);
      if (!price) continue;

      let triggerType = null;
      if (order.stopLossPrice   && price <= order.stopLossPrice)   triggerType = 'stop_loss';
      if (order.takeProfitPrice && price >= order.takeProfitPrice) triggerType = 'take_profit';

      if (triggerType) {
        triggered.push({ order, price, triggerType });
        await Order.findByIdAndUpdate(order._id, { status: 'filled' });
      }
    }

    if (pushToUser && triggered.length) {
      for (const { order, price, triggerType } of triggered) {
        pushToUser(order.userId, {
          type: 'sl_tp_triggered',
          triggerType,
          mint:  order.symbol,
          price,
          amount: order.amount,
          stopLossPrice:   order.stopLossPrice,
          takeProfitPrice: order.takeProfitPrice,
          orderId: order._id,
        });
      }
      console.log(JSON.stringify({ event: 'sltp_triggered', count: triggered.length }));
    }
  } catch (e) {
    console.error(JSON.stringify({ event: 'sltp_checker_error', error: e.message }));
  }
}

function start(pushFn) {
  pushToUser = pushFn;
  setTimeout(() => {
    runCheck();
    timer = setInterval(runCheck, CHECK_INTERVAL_MS);
  }, 15000); // stagger 15s after alert checker starts
  console.log(JSON.stringify({ event: 'sltp_checker_start', intervalMs: CHECK_INTERVAL_MS }));
}

function stop() {
  if (timer) clearInterval(timer);
}

module.exports = { start, stop };
