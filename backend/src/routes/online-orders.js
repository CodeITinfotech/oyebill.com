import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database/index.js';

const router = express.Router();

// Get all online orders
router.get('/', (req, res) => {
  try {
    const { status, platform, limit = 50 } = req.query;
    
    let query = `
      SELECT oo.*, o.id as linked_order_number
      FROM online_orders oo
      LEFT JOIN orders o ON oo.linked_order_id = o.id
    `;
    const params = [];
    
    const conditions = [];
    if (status) {
      conditions.push('oo.status = ?');
      params.push(status);
    }
    if (platform) {
      conditions.push('oo.platform = ?');
      params.push(platform);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY oo.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const orders = db.prepare(query).all(...params);
    
    // Parse order_data JSON string if it exists
    const parsedOrders = orders.map(order => ({
      ...order,
      order_data: order.order_data ? JSON.parse(order.order_data) : null
    }));
    
    res.json({ success: true, data: parsedOrders });
  } catch (error) {
    console.error('Error fetching online orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch online orders' });
  }
});

// Get single online order
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const order = db.prepare(`
      SELECT oo.*, o.id as linked_order_number
      FROM online_orders oo
      LEFT JOIN orders o ON oo.linked_order_id = o.id
      WHERE oo.id = ?
    `).get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Parse order_data if exists
    if (order.order_data) {
      order.order_data = JSON.parse(order.order_data);
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching online order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch online order' });
  }
});

// Create online order (webhook from Swiggy/Zomato)
router.post('/', (req, res) => {
  try {
    const { external_order_id, platform, customer_name, customer_phone, delivery_address, order_data, total_amount, items_count, estimated_time } = req.body;
    
    if (!platform) {
      return res.status(400).json({ success: false, error: 'Platform is required' });
    }
    
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO online_orders (id, external_order_id, platform, customer_name, customer_phone, delivery_address, order_data, total_amount, items_count, estimated_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      external_order_id || null,
      platform,
      customer_name || null,
      customer_phone || null,
      delivery_address || null,
      order_data ? JSON.stringify(order_data) : null,
      total_amount || 0,
      items_count || 0,
      estimated_time || null
    );
    
    const order = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Error creating online order:', error);
    res.status(500).json({ success: false, error: 'Failed to create online order' });
  }
});

// Accept online order
router.post('/:id/accept', (req, res) => {
  try {
    const { id } = req.params;
    
    const order = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    if (order.status !== 'new') {
      return res.status(400).json({ success: false, error: 'Order has already been processed' });
    }
    
    db.prepare(`
      UPDATE online_orders 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    const updatedOrder = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error accepting online order:', error);
    res.status(500).json({ success: false, error: 'Failed to accept online order' });
  }
});

// Decline online order
router.post('/:id/decline', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const order = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    if (order.status !== 'new') {
      return res.status(400).json({ success: false, error: 'Order has already been processed' });
    }
    
    db.prepare(`
      UPDATE online_orders 
      SET status = 'declined', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    const updatedOrder = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error declining online order:', error);
    res.status(500).json({ success: false, error: 'Failed to decline online order' });
  }
});

// Update order status
router.post('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const order = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    db.prepare(`
      UPDATE online_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
    
    const updatedOrder = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating online order status:', error);
    res.status(500).json({ success: false, error: 'Failed to update online order status' });
  }
});

// Link online order to billing order
router.post('/:id/link-order', (req, res) => {
  try {
    const { id } = req.params;
    const { order_id } = req.body;
    
    const order = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Online order not found' });
    }
    
    const billingOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    
    if (!billingOrder) {
      return res.status(404).json({ success: false, error: 'Billing order not found' });
    }
    
    db.prepare(`
      UPDATE online_orders 
      SET linked_order_id = ?, status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order_id, id);
    
    const updatedOrder = db.prepare('SELECT * FROM online_orders WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error linking online order:', error);
    res.status(500).json({ success: false, error: 'Failed to link online order' });
  }
});

// Get order counts by status
router.get('/stats/counts', (req, res) => {
  try {
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM online_orders 
      GROUP BY status
    `).all();
    
    const stats = {
      new: 0,
      accepted: 0,
      preparing: 0,
      ready: 0,
      total: 0
    };
    
    counts.forEach(row => {
      if (stats.hasOwnProperty(row.status)) {
        stats[row.status] = row.count;
      }
      stats.total += row.count;
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching order counts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order counts' });
  }
});

export default router;