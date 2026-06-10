import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Delete all bookings (paid orders)
router.delete('/bookings/all', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    const result = db.prepare('DELETE FROM orders WHERE status = ? AND restaurant_id = ?').run('paid', req.user.restaurantId);
    res.json({ success: true, deleted: result.changes, message: 'All bookings deleted' });
  } catch (error) {
    console.error('Delete bookings error:', error);
    res.status(500).json({ error: 'Failed to delete bookings' });
  }
});

// Delete booking by bill number
router.delete('/bookings/bill/:billNumber', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    const { billNumber } = req.params;
    const result = db.prepare('DELETE FROM orders WHERE id LIKE ? AND restaurant_id = ?').run(`%${billNumber}%`, req.user.restaurantId);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, deleted: result.changes, message: `Booking ${billNumber} deleted` });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Delete bookings by date
router.delete('/bookings/date/:date', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    const { date } = req.params;
    const result = db.prepare('DELETE FROM orders WHERE DATE(created_at) = ? AND restaurant_id = ?').run(date, req.user.restaurantId);
    res.json({ success: true, deleted: result.changes, message: `${result.changes} bookings deleted for ${date}` });
  } catch (error) {
    console.error('Delete bookings by date error:', error);
    res.status(500).json({ error: 'Failed to delete bookings' });
  }
});

// Delete all KOTs
router.delete('/kot/all', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    // Get KOT order IDs first
    const kotOrders = db.prepare(`
      SELECT DISTINCT o.id FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.is_kot = 1 AND o.restaurant_id = ?
    `).all(req.user.restaurantId);
    
    let deleted = 0;
    for (const order of kotOrders) {
      const r = db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
      deleted += r.changes;
    }
    res.json({ success: true, deleted, message: 'All KOTs deleted' });
  } catch (error) {
    console.error('Delete KOTs error:', error);
    res.status(500).json({ error: 'Failed to delete KOTs' });
  }
});

// Delete KOT by date
router.delete('/kot/date/:date', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    const { date } = req.params;
    const kotOrders = db.prepare(`
      SELECT DISTINCT o.id FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.is_kot = 1 AND DATE(o.created_at) = ? AND o.restaurant_id = ?
    `).all(date, req.user.restaurantId);
    
    let deleted = 0;
    for (const order of kotOrders) {
      const r = db.prepare('DELETE FROM orders WHERE id = ?').run(order.id);
      deleted += r.changes;
    }
    res.json({ success: true, deleted, message: `${deleted} KOTs deleted for ${date}` });
  } catch (error) {
    console.error('Delete KOTs by date error:', error);
    res.status(500).json({ error: 'Failed to delete KOTs' });
  }
});

// Get all orders (history)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const { status, date } = req.query;

    let query = `
      SELECT o.*, t.number as table_number, u.name as user_name 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE t.restaurant_id = ?
    `;
    const params = [req.user.restaurantId];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    if (date) {
      query += ' AND DATE(o.created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY o.created_at DESC';

    const orders = db.prepare(query).all(...params);

    // Get items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return {
        id: order.id,
        tableId: order.table_id,
        tableNumber: order.table_number,
        userId: order.user_id,
        userName: order.user_name,
        status: order.status,
        items: items.map(item => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          taxRate: item.tax_rate,
          taxAmount: item.tax_amount,
          total: item.total,
          isKot: item.is_kot === 1,
        })),
        subtotal: order.subtotal,
        taxAmount: order.tax_amount,
        discountAmount: order.discount_amount,
        discountReason: order.discount_reason,
        total: order.total,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      };
    });

    res.json(ordersWithItems);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Get order by table (current order)
router.get('/table/:tableId', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    // Get active order for table (not billed)
    const order = db.prepare(`
      SELECT o.*, t.number as table_number, u.name as user_name 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.table_id = ? AND o.status != 'billed'
      ORDER BY o.created_at DESC
      LIMIT 1
    `).get(req.params.tableId);

    if (!order) {
      return res.status(404).json({ error: 'No active order for this table' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

    res.json({
      id: order.id,
      tableId: order.table_id,
      tableNumber: order.table_number,
      userId: order.user_id,
      userName: order.user_name,
      status: order.status,
      items: items.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxAmount: item.tax_amount,
        total: item.total,
        isKot: item.is_kot === 1,
      })),
      subtotal: order.subtotal,
      taxAmount: order.tax_amount,
      discountAmount: order.discount_amount,
      discountReason: order.discount_reason,
      total: order.total,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    });
  } catch (error) {
    console.error('Get order by table error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Update order's table (for table switching)
router.put('/:id/table', authenticateToken, (req, res) => {
  try {
    const { tableId } = req.body;
    const { db } = req;

    console.log('PUT /orders/:id/table called:', req.params.id, tableId);

    // Get the order
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      console.log('Order not found:', req.params.id);
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'billed') {
      return res.status(400).json({ error: 'Cannot move billed order' });
    }

    // Check if target table has an active order
    const existingOrder = db.prepare(`
      SELECT id FROM orders WHERE table_id = ? AND status != 'billed' AND id != ?
    `).get(tableId, req.params.id);

    if (existingOrder) {
      return res.status(400).json({ error: 'Target table already has an active order' });
    }

    // Update the order's table
    db.prepare('UPDATE orders SET table_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(tableId, req.params.id);

    // Update the tables
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('available', order.table_id);
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('occupied', tableId);

    console.log('Order moved successfully');
    res.json({ success: true, message: 'Order moved successfully' });
  } catch (error) {
    console.error('Update order table error:', error);
    res.status(500).json({ error: 'Failed to update order table' });
  }
});

// Delete order
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const { id } = req.params;

    // Delete order items first
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);

    // Delete the order
    const result = db.prepare('DELETE FROM orders WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Delete order item
router.delete('/:orderId/items/:itemId', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const { orderId, itemId } = req.params;

    // Check if order exists and is not billed
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status === 'billed') {
      return res.status(400).json({ error: 'Cannot modify billed order' });
    }

    // Delete the item
    const result = db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(itemId, orderId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update order totals
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      subtotal += item.unit_price * item.quantity;
      taxAmount += item.tax_amount;
    }
    const total = subtotal + taxAmount;
    db.prepare('UPDATE orders SET subtotal = ?, tax_amount = ?, total = ? WHERE id = ?')
      .run(subtotal, taxAmount, total, orderId);

    res.json({ 
      success: true, 
      message: 'Item deleted',
      itemsRemaining: items.length 
    });
  } catch (error) {
    console.error('Delete order item error:', error);
    res.status(500).json({ error: 'Failed to delete order item' });
  }
});

// Create order
router.post('/', authenticateToken, (req, res) => {
  try {
    const { tableId, items, waiterId, customerId } = req.body;
    const { db } = req;

    // Check for existing active order
    const existingOrder = db.prepare(`
      SELECT id FROM orders WHERE table_id = ? AND status != 'billed'
    `).get(tableId);

    if (existingOrder) {
      return res.status(400).json({ error: 'Active order already exists for this table' });
    }

    // Create order
    const orderId = uuidv4();
    db.prepare(`
      INSERT INTO orders (id, table_id, user_id, waiter_id, customer_id, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(orderId, tableId, req.user.id, waiterId || null, customerId || null);

    // Add items
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const itemId = uuidv4();
      const itemTotal = item.unitPrice * item.quantity;
      const itemTax = item.taxAmount * item.quantity;
      
      db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount, total, is_kot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.taxAmount, itemTotal + itemTax, item.isKot ? 1 : 0);

      subtotal += itemTotal;
      taxAmount += itemTax;
    }

    // Update order totals
    const total = subtotal + taxAmount;
    db.prepare(`
      UPDATE orders SET subtotal = ?, tax_amount = ?, total = ? WHERE id = ?
    `).run(subtotal, taxAmount, total, orderId);

    // Update table status
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('occupied', tableId);

    // Return order
    const order = db.prepare(`
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(orderId);

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    res.status(201).json({
      id: order.id,
      tableId: order.table_id,
      tableNumber: order.table_number,
      userId: order.user_id,
      status: order.status,
      items: orderItems.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxAmount: item.tax_amount,
        total: item.total,
        isKot: item.is_kot === 1,
      })),
      subtotal: order.subtotal,
      taxAmount: order.tax_amount,
      discountAmount: order.discount_amount,
      discountReason: order.discount_reason,
      total: order.total,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order (add/update items)
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { items } = req.body;
    const { db } = req;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'billed') {
      return res.status(400).json({ error: 'Cannot update billed order' });
    }

    // Delete existing items
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);

    // Add new items
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const itemId = uuidv4();
      const itemTotal = item.unitPrice * item.quantity;
      const itemTax = item.taxAmount * item.quantity;
      
      db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount, total, is_kot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, req.params.id, item.productId, item.productName, item.quantity, item.unitPrice, item.taxRate, item.taxAmount, itemTotal + itemTax, item.isKot ? 1 : 0);

      subtotal += itemTotal;
      taxAmount += itemTax;
    }

    // Update order totals
    const total = subtotal + taxAmount - order.discount_amount;
    db.prepare(`
      UPDATE orders SET subtotal = ?, tax_amount = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(subtotal, taxAmount, total, req.params.id);

    // Update table status to occupied when items are added
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('occupied', order.table_id);

    // Return updated order
    const updatedOrder = db.prepare(`
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(req.params.id);

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

    res.json({
      id: updatedOrder.id,
      tableId: updatedOrder.table_id,
      tableNumber: updatedOrder.table_number,
      userId: updatedOrder.user_id,
      status: updatedOrder.status,
      items: orderItems.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxAmount: item.tax_amount,
        total: item.total,
        isKot: item.is_kot === 1,
      })),
      subtotal: updatedOrder.subtotal,
      taxAmount: updatedOrder.tax_amount,
      discountAmount: updatedOrder.discount_amount,
      discountReason: updatedOrder.discount_reason,
      total: updatedOrder.total,
      createdAt: updatedOrder.created_at,
      updatedAt: updatedOrder.updated_at,
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Generate KOT
router.post('/:id/kot', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Mark all items as KOT
    db.prepare('UPDATE order_items SET is_kot = 1 WHERE order_id = ?').run(req.params.id);

    // Update order status to KOT if pending
    if (order.status === 'pending') {
      db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('kot', req.params.id);
    }

    // Update table status to active (KOT generated)
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('active', order.table_id);

    // Return updated order
    const updatedOrder = db.prepare(`
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(req.params.id);

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

    res.json({
      id: updatedOrder.id,
      tableId: updatedOrder.table_id,
      tableNumber: updatedOrder.table_number,
      userId: updatedOrder.user_id,
      status: updatedOrder.status,
      items: orderItems.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxAmount: item.tax_amount,
        total: item.total,
        isKot: item.is_kot === 1,
      })),
      subtotal: updatedOrder.subtotal,
      taxAmount: updatedOrder.tax_amount,
      discountAmount: updatedOrder.discount_amount,
      discountReason: updatedOrder.discount_reason,
      total: updatedOrder.total,
      createdAt: updatedOrder.created_at,
      updatedAt: updatedOrder.updated_at,
    });
  } catch (error) {
    console.error('Generate KOT error:', error);
    res.status(500).json({ error: 'Failed to generate KOT' });
  }
});

// Generate bill
router.post('/:id/bill', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update order status
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('billed', req.params.id);

    // Set table to pending_cleaning status (busser needs to clean before next use)
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('pending_cleaning', order.table_id);

    res.json({ message: 'Bill generated successfully', orderId: order.id, tableStatus: 'pending_cleaning' });
  } catch (error) {
    console.error('Generate bill error:', error);
    res.status(500).json({ error: 'Failed to generate bill' });
  }
});

// Apply discount
router.post('/:id/discount', authenticateToken, (req, res) => {
  try {
    const { amount, reason } = req.body;
    const { db } = req;

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update discount
    const newTotal = order.subtotal + order.tax_amount - amount;
    db.prepare(`
      UPDATE orders SET discount_amount = ?, discount_reason = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(amount, reason, newTotal, req.params.id);

    // Return updated order
    const updatedOrder = db.prepare(`
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(req.params.id);

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);

    res.json({
      id: updatedOrder.id,
      tableId: updatedOrder.table_id,
      tableNumber: updatedOrder.table_number,
      userId: updatedOrder.user_id,
      status: updatedOrder.status,
      items: orderItems.map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        taxRate: item.tax_rate,
        taxAmount: item.tax_amount,
        total: item.total,
        isKot: item.is_kot === 1,
      })),
      subtotal: updatedOrder.subtotal,
      taxAmount: updatedOrder.tax_amount,
      discountAmount: updatedOrder.discount_amount,
      discountReason: updatedOrder.discount_reason,
      total: updatedOrder.total,
      createdAt: updatedOrder.created_at,
      updatedAt: updatedOrder.updated_at,
    });
  } catch (error) {
    console.error('Apply discount error:', error);
    res.status(500).json({ error: 'Failed to apply discount' });
  }
});

export default router;