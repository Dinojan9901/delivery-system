const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'order_notifications';

let channel = null;

const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('Order Service connected to RabbitMQ');
  } catch (err) {
    console.error('RabbitMQ connection failed, retrying in 5s...', err.message);
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishOrderEvent = async (eventType, order) => {
  if (!channel) {
    console.warn('RabbitMQ channel not ready, skipping publish');
    return;
  }
  const message = JSON.stringify({ eventType, order, timestamp: new Date().toISOString() });
  channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true });
  console.log(`Published event: ${eventType} for order ${order._id}`);
};

module.exports = { connectRabbitMQ, publishOrderEvent };
