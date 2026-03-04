const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.use(verifyToken);

router.get('/', orderController.getOrders);
router.post('/', orderController.createOrder);
router.patch('/:id/cancel', orderController.cancelOrder);

module.exports = router;
