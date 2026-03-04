const { Moralis } = require('../config/moralis');

exports.getNFTs = async (req, res) => {
  try {
    const { address, chain = 'eth' } = req.query;
    const response = await Moralis.EvmApi.nft.getWalletNFTs({ address, chain });
    res.json(response.raw);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTokenBalances = async (req, res) => {
  try {
    const { address, chain = 'eth' } = req.query;
    const response = await Moralis.EvmApi.token.getWalletTokenBalances({ address, chain });
    res.json(response.raw);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { address, chain = 'eth' } = req.query;
    const response = await Moralis.EvmApi.transaction.getWalletTransactions({ address, chain });
    res.json(response.raw);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
