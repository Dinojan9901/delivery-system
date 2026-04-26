const express = require('express');
const Order = require('../models/Order');
const authenticate = require('../middleware/auth');
const { publishOrderEvent } = require('../rabbitmq/publisher');

const router = express.Router();

// POST /api/orders  - Create new order
router.post('/', authenticate, async (req, res) => {
  try {
    const { restaurantName, deliveryAddress, items, notes } = req.body;
    if (!restaurantName || !deliveryAddress || !items || items.length === 0) {
      return res.status(400).json({ message: 'restaurantName, deliveryAddress, and items are required' });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = new Order({
      customerId: req.user.id,
      customerEmail: req.user.email,
      restaurantName,
      deliveryAddress,
      items,
      totalAmount,
      notes
    });

    await order.save();

    // Async: publish to RabbitMQ so notification service is triggered
    await publishOrderEvent('ORDER_PLACED', order);

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/orders - Get all orders (admin) or own orders (customer)
router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { customerId: req.user.id };
    const orders = await Order.find(query).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role !== 'admin' && order.customerId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/orders/:id/status - Update order status (admin only)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) return res.status(404).json({ message: 'Order not found' });

    await publishOrderEvent('ORDER_STATUS_UPDATED', order);

    res.json({ message: 'Order status updated', order });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/orders/:id - Cancel order
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role !== 'admin' && order.customerId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    order.status = 'cancelled';
    await order.save();
    await publishOrderEvent('ORDER_CANCELLED', order);

    res.json({ message: 'Order cancelled', order });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
