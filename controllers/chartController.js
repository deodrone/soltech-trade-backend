const ChartData = require('../models/ChartData');

exports.getChartData = async (req, res) => {
  try {
    const data = await ChartData.findOne({ symbol: req.query.symbol || 'ETH/USD' })
      .sort('-createdAt')
      .limit(100);

    if (!data) {
      return res.json({ labels: [], prices: [] });
    }

    res.json({ labels: data.timestamps, prices: data.prices });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
