const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/auth-db';

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

const connectWithRetry = () => {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Auth Service connected to MongoDB');
      app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
    })
    .catch(err => {
      console.error('MongoDB connection failed, retrying in 5s...', err.message);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();
