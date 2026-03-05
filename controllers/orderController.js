const Order = require('../models/Order');

exports.getOrders = async (req, res) => {
  try {
    const query = {};
    // Support both authenticated userId and public wallet query
    if (req.user?.uid) query.userId = req.user.uid;
    else if (req.query.wallet) query.userId = req.query.wallet;
    else if (req.query.userId) query.userId = req.query.userId;
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    const orders = await Order.find(query).sort('-createdAt').limit(100);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const order = await Order.create(req.body);
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
