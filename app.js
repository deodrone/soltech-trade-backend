require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { rateLimit } = require('express-rate-limit');
const http = require('http');
const WebSocket = require('ws');
const connectDB = require('./config/db');
const { initFirebase, admin } = require('./config/firebase');
const alertChecker = require('./jobs/alertChecker');

const app = express();
const server = http.createServer(app);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Managed by frontend (Netlify headers)
  crossOriginEmbedderPolicy: false,
}));

// ── CORS — allow localhost dev + deployed frontend URLs ──────────────────────
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

// ── Body parsing — limit size to prevent payload attacks ────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// ── MongoDB injection sanitization ──────────────────────────────────────────
app.use(mongoSanitize());

// ── Global rate limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ── Strict rate limiter for write / auth-sensitive endpoints ─────────────────
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

// Routes
app.use('/api', require('./routes/chart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/blockchain', require('./routes/blockchain'));
app.use('/api/helius', require('./routes/helius'));
app.use('/api/birdeye', require('./routes/birdeye'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/copy-trade', require('./routes/copyTrade'));
app.use('/api/launchpad', require('./routes/launchpad'));
app.use('/api/premium', require('./routes/premium'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── WebSocket server ────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

// Map: uid -> Set of ws clients
const clients = new Map();

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://localhost`);
  const token = url.searchParams.get('token');

  let uid = null;
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {}
  }

  ws.uid = uid;
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

// Heartbeat
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Push event to specific user
function pushToUser(uid, payload) {
  const userClients = clients.get(uid);
  if (!userClients) return;
  const msg = JSON.stringify(payload);
  userClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

app.locals.pushToUser = pushToUser;
app.locals.wss = wss;

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  initFirebase();
  await connectDB();
  // Note: Moralis removed — replace with Helius
  server.listen(PORT, () => {
    console.log(`Server + WS running on port ${PORT}`);
    alertChecker.start(pushToUser);
  });
};

start();

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  alertChecker.stop();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException',  (err)    => { console.error('Uncaught exception:', err.message); process.exit(1); });
