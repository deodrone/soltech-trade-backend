const axios = require('axios');
const Alert = require('../models/Alert');

const JUPITER_PRICE = 'https://api.jup.ag/price/v2';
const CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const RETRIGGER_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown per alert

let pushToUser = null;
let timer = null;

// Fetch prices for a list of mints in one Jupiter batch call
async function fetchPrices(mints) {
  if (!mints.length) return {};
  try {
    const { data } = await axios.get(`${JUPITER_PRICE}?ids=${mints.join(',')}`, { timeout: 10000 });
    return data.data || {};
  } catch {
    return {};
  }
}

function conditionMet(condition, currentPrice, targetValue) {
  switch (condition) {
    case 'above': return currentPrice >= targetValue;
    case 'below': return currentPrice <= targetValue;
    default:      return false;
  }
}

async function runCheck() {
  try {
    // Load all active price alerts
    const alerts = await Alert.find({ type: 'price', active: true, mint: { $exists: true } });
    if (!alerts.length) return;

    // Dedupe mints and fetch prices in one request
    const mints = [...new Set(alerts.map(a => a.mint).filter(Boolean))];
    const prices = await fetchPrices(mints);

    const now = Date.now();
    const toUpdate = [];
    const triggered = [];

    for (const alert of alerts) {
      const priceInfo = prices[alert.mint];
      if (!priceInfo) continue;

      const currentPrice = parseFloat(priceInfo.price);
      if (!currentPrice) continue;

      // Respect cooldown — don't spam the same alert
      if (alert.lastTriggered && now - alert.lastTriggered.getTime() < RETRIGGER_COOLDOWN_MS) continue;

      if (conditionMet(alert.condition, currentPrice, alert.value)) {
        triggered.push({ alert, currentPrice });
        toUpdate.push({
          id: alert._id,
          lastTriggered: new Date(),
          // Deactivate one-shot alerts (above/below fire once then go inactive)
          active: false,
        });
      }
    }

    // Persist updates
    if (toUpdate.length) {
      await Promise.all(
        toUpdate.map(u =>
          Alert.findByIdAndUpdate(u.id, { lastTriggered: u.lastTriggered, active: u.active })
        )
      );
    }

    // Push WS notifications
    if (pushToUser) {
      for (const { alert, currentPrice } of triggered) {
        pushToUser(alert.userId, {
          type: 'alert_triggered',
          alert: {
            id: alert._id,
            mint: alert.mint,
            condition: alert.condition,
            value: alert.value,
            currentPrice,
          },
        });
      }
    }

    if (triggered.length) {
      console.log(`[alertChecker] Triggered ${triggered.length} alert(s)`);
    }
  } catch (e) {
    console.error('[alertChecker] Error:', e.message);
  }
}

function start(pushFn) {
  pushToUser = pushFn;
  // Stagger first run by 10s to let DB connect fully
  setTimeout(() => {
    runCheck();
    timer = setInterval(runCheck, CHECK_INTERVAL_MS);
  }, 10000);
  console.log('[alertChecker] Started — checking every 30s');
}

function stop() {
  if (timer) clearInterval(timer);
}

module.exports = { start, stop };
