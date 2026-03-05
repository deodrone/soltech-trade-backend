require('dotenv').config();

// ── Environment validation ────────────────────────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI', 'FIREBASE_SERVICE_ACCOUNT', 'HELIUS_API_KEY', 'BIRDEYE_API_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');
const http        = require('http');
const WebSocket   = require('ws');
const connectDB   = require('./config/db');
const { initFirebase, admin } = require('./config/firebase');
const alertChecker  = require('./jobs/alertChecker');
const slTpChecker   = require('./jobs/slTpChecker');

const app    = express();

// Trust nginx proxy (fixes express-rate-limit IPv6 validation + req.ip)
app.set('trust proxy', 1);
const server = http.createServer(app);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,       // managed by Netlify headers
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip compression ──────────────────────────────────────────────────────────
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.S3_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// ── Request ID for tracing ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req.id = Math.random().toString(36).slice(2, 10);
  next();
});

// ── Access log (structured) ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (res.statusCode >= 400) {
      console.error(JSON.stringify({ id: req.id, method: req.method, url: req.url, status: res.statusCode, ms }));
    } else {
      console.log(JSON.stringify({ id: req.id, method: req.method, url: req.url, status: res.statusCode, ms }));
    }
  });
  next();
});

// ── Rate limiters ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/premium/subscribe', strictLimiter);
app.use('/api/orders', strictLimiter);
app.use('/api/launchpad', strictLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api',             require('./routes/chart'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/blockchain',  require('./routes/blockchain'));
app.use('/api/helius',      require('./routes/helius'));
app.use('/api/birdeye',     require('./routes/birdeye'));
app.use('/api/portfolio',   require('./routes/portfolio'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/copy-trade',  require('./routes/copyTrade'));
app.use('/api/analytics',   require('./routes/analytics'));
app.use('/api/launchpad',   require('./routes/launchpad'));
app.use('/api/premium',     require('./routes/premium'));
app.use('/api/referral',    require('./routes/referral'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── 404 for unknown API routes ────────────────────────────────────────────────
app.use('/api/*path', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(JSON.stringify({ id: req.id, error: err.message, stack: err.stack?.split('\n')[1] }));
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });
const clients = new Map(); // uid → Set<ws>

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  let uid = null;
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch { /* anonymous connection — limited access */ }
  }

  ws.uid     = uid;
  ws.isAlive = true;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch {}
  });

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('close', () => {
    if (uid && clients.has(uid)) {
      clients.get(uid).delete(ws);
      if (clients.get(uid).size === 0) clients.delete(uid);
    }
  });

  if (uid) {
    if (!clients.has(uid)) clients.set(uid, new Set());
    clients.get(uid).add(ws);
  }
});

// Heartbeat — terminate stale connections every 30s
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

function pushToUser(uid, payload) {
  const userClients = clients.get(uid);
  if (!userClients) return;
  const msg = JSON.stringify(payload);
  userClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

app.locals.pushToUser = pushToUser;
app.locals.wss        = wss;

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  initFirebase();
  await connectDB();
  server.listen(PORT, () => {
    console.log(JSON.stringify({ event: 'server_start', port: PORT, env: process.env.NODE_ENV }));
    alertChecker.start(pushToUser);
    slTpChecker.start(pushToUser);
  });
};

start();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(JSON.stringify({ event: 'shutdown', signal }));
  alertChecker.stop();
  slTpChecker.stop();
  server.close(() => {
    console.log(JSON.stringify({ event: 'server_closed' }));
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error(JSON.stringify({ event: 'unhandledRejection', reason: String(reason) })));
process.on('uncaughtException',  (err)    => {
  console.error(JSON.stringify({ event: 'uncaughtException', error: err.message }));
  process.exit(1);
});
