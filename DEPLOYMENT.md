# Backend Deployment Guide

## Platform
AWS Elastic Beanstalk — Node.js 20 platform, `us-east-1`
App: `soltech-trade-backend` / Env: `soltech-trade-backend-env`

## GitHub Secrets Required

Set these in **Settings → Secrets and variables → Actions** before the pipeline will work:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user key with `elasticbeanstalk:*` + `s3:*` (deploy bucket) |
| `AWS_SECRET_ACCESS_KEY` | Corresponding secret key |
| `BACKEND_URL` | Full URL of the EB environment, e.g. `https://api.soltechtrade.com` |

## Elastic Beanstalk Environment Variables

Set these in the EB console under **Configuration → Software → Environment properties**:

| Variable | Notes |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` (EB proxy forwards 80 → 5000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON of the Firebase service account key (stringified) |
| `HELIUS_API_KEY` | Helius API key |
| `BIRDEYE_API_KEY` | Birdeye API key |
| `FRONTEND_URL` | Netlify frontend URL, e.g. `https://soltechtrade.netlify.app` |
| `S3_URL` | S3 static URL if serving assets from S3 (optional, for CORS) |
| `PLATFORM_WALLET` | Solana wallet address that receives subscription payments |
| `SUBSCRIPTION_PRICE_SOL` | Default `0.05` |

## Deploy Flow

1. Push to `main` branch
2. GitHub Actions runs `lint` job
3. On lint success, `deploy` job:
   - Creates `deploy.zip` (excludes `node_modules`, `.env`, logs)
   - Uploads zip to EB via `einaregilsson/beanstalk-deploy@v22`
   - EB runs `npm install --production` and restarts the app
4. Post-deploy health check hits `GET /health` — must return `200` within 20s

## Local Development

```bash
cp .env.example .env
# Fill in all variables
npm install
npm run dev    # or: node app.js
```

## Scaling Considerations

- **Single instance**: default setup; fine for early launch
- **Multi-instance**: WebSocket state is in-memory (`clients` Map in `app.js`). To support
  multiple EB instances, replace with a Redis pub/sub broker so WS pushes reach users
  regardless of which instance they're connected to
- **DB pool**: `maxPoolSize: 10` in `config/db.js` — increase for higher concurrency
- **Jobs**: `alertChecker` and `slTpChecker` run in every instance. On multi-instance EB,
  use a dedicated "worker" tier or a distributed lock (e.g., MongoDB TTL lock) to prevent
  duplicate job runs
