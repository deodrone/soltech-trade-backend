const Moralis = require('moralis').default;

const initMoralis = async () => {
  await Moralis.start({ apiKey: process.env.MORALIS_API_KEY });
  console.log('Moralis initialized');
};

module.exports = { Moralis, initMoralis };
