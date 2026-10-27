const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/imovies';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  // Replace the old text index (it broke saving movies with language 'Hindi') with the fixed one.
  try {
    await require('../models/Movie').syncIndexes();
  } catch (e) {
    console.warn('Index update skipped:', e.message);
  }
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};
