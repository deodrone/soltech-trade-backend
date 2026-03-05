const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });

  console.log(JSON.stringify({ event: 'mongo_connected', host: conn.connection.host }));

  mongoose.connection.on('disconnected', () => console.warn(JSON.stringify({ event: 'mongo_disconnected' })));
  mongoose.connection.on('error', (err) => console.error(JSON.stringify({ event: 'mongo_error', error: err.message })));
};

module.exports = connectDB;
