const Order = require('../models/Order');

const ALLOWED_TYPES    = new Set(['buy', 'sell', 'sl_tp', 'limit']);
const ALLOWED_STATUSES = new Set(['open', 'filled', 'cancelled']);

exports.getOrders = async (req, res) => {
  try {
    const query = { userId: req.user.uid }; // always scope to authenticated user
    if (req.query.type   && ALLOWED_TYPES.has(req.query.type))     query.type   = req.query.type;
    if (req.query.status && ALLOWED_STATUSES.has(req.query.status)) query.status = req.query.status;
    const orders = await Order.find(query).sort('-createdAt').limit(100);
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { symbol, type, amount, price, stopLossPrice, takeProfitPrice, status } = req.body;

    if (!symbol || !type || amount == null) {
      return res.status(400).json({ error: 'symbol, type, and amount are required' });
    }
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid order type' });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const order = await Order.create({
      userId: req.user.uid,   // always from JWT, never from body
      symbol,
      type,
      amount,
      price:          typeof price === 'number'          ? price          : 0,
      stopLossPrice:  typeof stopLossPrice === 'number'  ? stopLossPrice  : null,
      takeProfitPrice: typeof takeProfitPrice === 'number' ? takeProfitPrice : null,
      status: status && ALLOWED_STATUSES.has(status) ? status : 'open',
    });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    // Scope to req.user.uid — prevents any user from cancelling another user's order
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { status: 'cancelled' },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
