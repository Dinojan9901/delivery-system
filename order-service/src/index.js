const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const orderRoutes = require('./routes/orders');
const { connectRabbitMQ } = require('./rabbitmq/publisher');

const app = express();
const PORT = process.env.PORT || 3002;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/order-db';

app.use(cors());
app.use(express.json());

app.use('/api/orders', orderRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

const connectWithRetry = () => {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Order Service connected to MongoDB');
      return connectRabbitMQ();
    })
    .then(() => {
      app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
    })
    .catch(err => {
      console.error('Startup failed, retrying in 5s...', err.message);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();
