import express from 'express';
import crypto from 'crypto';
import db from '../../database/index.js';

const router = express.Router();

// Get table info by table number (for NFC/QR scan)
router.get('/table/:tableNumber', (req, res) => {
  try {
    const { tableNumber } = req.params;
    
    const table = db.prepare(`
      SELECT 
        t.*,
        s.name as section_name
      FROM tables t
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.number = ?
    `).get(tableNumber);
    
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }
    
    // Get assigned waiters for this table
    const waiters = db.prepare(`
      SELECT u.id, u.name, u.role
      FROM table_waiter_allocations twa
      JOIN users u ON twa.waiter_id = u.id
      WHERE twa.table_id = ? AND twa.is_active = 1
    `).all(table.id);
    
    res.json({ 
      success: true, 
      data: { 
        ...table,
        assignedWaiters: waiters 
      } 
    });
  } catch (error) {
    console.error('Error fetching table:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch table' });
  }
});

// Create a new customer order (via NFC/QR)
router.post('/', (req, res) => {
  try {
    const { tableId, tableNumber, items, customerName, customerPhone, notes, restaurantId, orderSource } = req.body;
    
    if (!tableId || !tableNumber || !items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Table ID, table number, and items are required' });
    }
    
    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    
    const processedItems = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemTax = itemTotal * (item.taxRate / 100);
      subtotal += itemTotal;
      totalTax += itemTax;
      return {
        ...item,
        total: itemTotal,
        taxAmount: itemTax
      };
    });
    
    const total = subtotal + totalTax;
    
    const orderId = crypto.randomUUID();
    const source = orderSource || 'nfc';
    
    // Create customer order
    db.prepare(`
      INSERT INTO customer_orders (id, table_id, table_number, customer_name, customer_phone, status, subtotal, tax_amount, total, items_count, order_source, notes, restaurant_id)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, tableId, tableNumber, customerName || null, customerPhone || null, subtotal, totalTax, total, items.length, source, notes || null, restaurantId || null);
    
    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO customer_order_items (id, customer_order_id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of processedItems) {
      insertItem.run(
        crypto.randomUUID(),
        orderId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.taxRate || 0,
        item.taxAmount,
        item.total
      );
    }
    
    // Find waiters assigned to this table and create notifications
    const waiters = db.prepare(`
      SELECT waiter_id FROM table_waiter_allocations 
      WHERE table_id = ? AND is_active = 1
    `).all(tableId);
    
    const insertNotification = db.prepare(`
      INSERT INTO waiter_notifications (id, waiter_id, table_id, table_number, customer_order_id, notification_type, title, message)
      VALUES (?, ?, ?, ?, ?, 'order', ?, ?)
    `);
    
    for (const w of waiters) {
      insertNotification.run(
        crypto.randomUUID(),
        w.waiter_id,
        tableId,
        tableNumber,
        orderId,
        `New Order - Table ${tableNumber}`,
        `Customer order received. ${items.length} item(s), Total: ₹${total.toFixed(2)}`
      );
    }
    
    // Also notify admin
    const admins = db.prepare(`
      SELECT id FROM users WHERE role = 'admin' AND restaurant_id = ?
    `).all(restaurantId);
    
    for (const admin of admins) {
      insertNotification.run(
        crypto.randomUUID(),
        admin.id,
        tableId,
        tableNumber,
        orderId,
        'order',
        `New Order - Table ${tableNumber}`,
        `Customer order via ${source}. ${items.length} item(s), Total: ₹${total.toFixed(2)}`
      );
    }
    
    res.json({ 
      success: true, 
      data: { 
        id: orderId,
        tableNumber,
        subtotal,
        totalTax,
        total,
        itemsCount: items.length,
        status: 'pending'
      } 
    });
  } catch (error) {
    console.error('Error creating customer order:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  }
});

// Get pending orders for a waiter
router.get('/waiter/:waiterId/pending', (req, res) => {
  try {
    const { waiterId } = req.params;
    
    // Get orders from tables assigned to this waiter
    const orders = db.prepare(`
      SELECT co.*, t.number as table_number
      FROM customer_orders co
      JOIN tables t ON co.table_id = t.id
      JOIN table_waiter_allocations twa ON t.id = twa.table_id
      WHERE twa.waiter_id = ? 
        AND twa.is_active = 1
        AND co.status = 'pending'
      ORDER BY co.created_at DESC
    `).all(waiterId);
    
    // Get items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare(`
        SELECT * FROM customer_order_items WHERE customer_order_id = ?
      `).all(order.id);
      return { ...order, items };
    });
    
    res.json({ success: true, data: ordersWithItems });
  } catch (error) {
    console.error('Error fetching waiter orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Accept a customer order
router.put('/:id/accept', (req, res) => {
  try {
    const { id } = req.params;
    const { waiterId } = req.body;
    
    const order = db.prepare('SELECT * FROM customer_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Order cannot be accepted' });
    }
    
    // Update order status
    db.prepare(`
      UPDATE customer_orders 
      SET status = 'accepted', accepted_by = ?, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(waiterId, id);
    
    // Create notification for the waiter
    db.prepare(`
      INSERT INTO waiter_notifications (id, waiter_id, table_id, table_number, customer_order_id, notification_type, title, message, is_read, is_acknowledged)
      VALUES (?, ?, ?, ?, ?, 'accept', ?, ?, 1, 1)
    `).run(
      crypto.randomUUID(),
      waiterId,
      order.table_id,
      order.table_number,
      id,
      'Order Accepted',
      `You accepted order from Table ${order.table_number}`
    );
    
    res.json({ success: true, message: 'Order accepted' });
  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({ success: false, error: 'Failed to accept order' });
  }
});

// Decline a customer order
router.put('/:id/decline', (req, res) => {
  try {
    const { id } = req.params;
    const { waiterId, reason } = req.body;
    
    const order = db.prepare('SELECT * FROM customer_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Order cannot be declined' });
    }
    
    // Update order status
    db.prepare(`
      UPDATE customer_orders 
      SET status = 'declined', declined_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason || null, id);
    
    // Notify admin about declined order
    const admins = db.prepare(`
      SELECT id FROM users WHERE role = 'admin' AND restaurant_id = ?
    `).all(order.restaurant_id);
    
    const insertNotification = db.prepare(`
      INSERT INTO waiter_notifications (id, waiter_id, table_id, table_number, customer_order_id, notification_type, title, message)
      VALUES (?, ?, ?, ?, ?, 'decline', ?, ?)
    `);
    
    for (const admin of admins) {
      insertNotification.run(
        crypto.randomUUID(),
        admin.id,
        order.table_id,
        order.table_number,
        id,
        'Order Declined',
        `Order from Table ${order.table_number} was declined. Reason: ${reason || 'No reason provided'}`
      );
    }
    
    res.json({ success: true, message: 'Order declined' });
  } catch (error) {
    console.error('Error declining order:', error);
    res.status(500).json({ success: false, error: 'Failed to decline order' });
  }
});

// Get order by ID with items
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const order = db.prepare('SELECT * FROM customer_orders WHERE id = ?').get(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const items = db.prepare('SELECT * FROM customer_order_items WHERE customer_order_id = ?').all(id);
    
    res.json({ 
      success: true, 
      data: { ...order, items } 
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// Get all customer orders (for admin)
router.get('/', (req, res) => {
  try {
    const { restaurantId, status, limit } = req.query;
    
    let query = `
      SELECT co.*, t.number as table_number, u.name as accepted_by_name
      FROM customer_orders co
      JOIN tables t ON co.table_id = t.id
      LEFT JOIN users u ON co.accepted_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (restaurantId) {
      query += ' AND co.restaurant_id = ?';
      params.push(restaurantId);
    }
    
    if (status) {
      query += ' AND co.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY co.created_at DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const orders = db.prepare(query).all(...params);
    
    // Get items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM customer_order_items WHERE customer_order_id = ?').all(order.id);
      return { ...order, items };
    });
    
    res.json({ success: true, data: ordersWithItems });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

export default router;