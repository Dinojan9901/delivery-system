const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Notification = require('./models/Notification');
const { connectRabbitMQ } = require('./rabbitmq/consumer');
const authenticate = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/notification-db';

app.use(cors());
app.use(express.json());

// GET /api/notifications - Get all notifications (customers see own, admins see all)
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const { customerId, email } = req.query;
    const query = {};
    if (req.user.role !== 'admin') {
      query.customerId = req.user.id;
    } else {
      if (customerId) query.customerId = customerId;
      if (email) query.customerEmail = email;
    }
    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/notifications/order/:orderId
app.get('/api/notifications/order/:orderId', authenticate, async (req, res) => {
  try {
    const query = { orderId: req.params.orderId };
    if (req.user.role !== 'admin') query.customerId = req.user.id;
    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

const connectWithRetry = () => {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Notification Service connected to MongoDB');
      return connectRabbitMQ();
    })
    .then(() => {
      app.listen(PORT, () => console.log(`Notification Service running on port ${PORT}`));
    })
    .catch(err => {
      console.error('Startup failed, retrying in 5s...', err.message);
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();
