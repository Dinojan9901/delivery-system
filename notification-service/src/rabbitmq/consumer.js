const amqp = require('amqplib');
const Notification = require('../models/Notification');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'order_notifications';

const buildMessage = (eventType, order) => {
  const messages = {
    ORDER_PLACED: `Your order from ${order.restaurantName} has been placed! Total: $${order.totalAmount.toFixed(2)}. We will notify you when it is confirmed.`,
    ORDER_STATUS_UPDATED: `Your order from ${order.restaurantName} status has been updated to: ${order.status.toUpperCase()}.`,
    ORDER_CANCELLED: `Your order from ${order.restaurantName} has been cancelled.`
  };
  return messages[eventType] || `Order update: ${eventType}`;
};

const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    channel.prefetch(1);

    console.log('Notification Service listening on queue:', QUEUE_NAME);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        const { eventType, order } = payload;

        console.log(`Received event: ${eventType} for order ${order._id}`);

        const message = buildMessage(eventType, order);

        // Simulate sending email/SMS — in production, integrate SendGrid or Twilio here
        console.log(`[NOTIFICATION] To: ${order.customerEmail} | ${message}`);

        const notification = new Notification({
          orderId: order._id,
          customerId: order.customerId,
          customerEmail: order.customerEmail,
          eventType,
          message,
          status: 'sent'
        });
        await notification.save();

        channel.ack(msg);
      } catch (err) {
        console.error('Failed to process message:', err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (err) {
    console.error('RabbitMQ connection failed, retrying in 5s...', err.message);
    setTimeout(connectRabbitMQ, 5000);
  }
};

module.exports = { connectRabbitMQ };
