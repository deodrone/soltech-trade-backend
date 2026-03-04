const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const blockchainController = require('../controllers/blockchainController');

router.use(verifyToken);

router.get('/nfts', blockchainController.getNFTs);
router.get('/tokens', blockchainController.getTokenBalances);
router.get('/transactions', blockchainController.getTransactions);

module.exports = router;
