require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initMoralis } = require('./config/moralis');
const { initFirebase } = require('./config/firebase');

const app = express();

// Middleware
app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());

// Routes
app.use('/api', require('./routes/chart'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/blockchain', require('./routes/blockchain'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

const start = async () => {
  initFirebase();
  await connectDB();
  await initMoralis();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
