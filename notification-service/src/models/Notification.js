const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  customerId: { type: String, required: true },
  customerEmail: { type: String, required: true },
  eventType: {
    type: String,
    enum: ['ORDER_PLACED', 'ORDER_STATUS_UPDATED', 'ORDER_CANCELLED'],
    required: true
  },
  message: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
