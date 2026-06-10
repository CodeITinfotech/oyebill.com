import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import db from '../../database/index.js';

const router = express.Router();

// Get online ordering settings (admin)
router.get('/', authenticateToken, (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    if (!settings) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO online_ordering_settings (id, restaurant_id)
        VALUES (?, ?)
      `).run(id, restaurantId);
      
      settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    }
    
    res.json({
      success: true,
      data: {
        id: settings.id,
        isEnabled: settings.is_enabled === 1,
        freeDeliveryRadiusKm: settings.free_delivery_radius_km,
        paidDeliveryRadiusKm: settings.paid_delivery_radius_km,
        deliveryCharge: settings.delivery_charge,
        minOrderAmount: settings.min_order_amount,
        allowPickup: settings.allow_pickup === 1,
        allowDelivery: settings.allow_delivery === 1,
        estimatedPrepTimeMinutes: settings.estimated_prep_time_minutes,
        deliveryInstructions: settings.delivery_instructions
      }
    });
  } catch (error) {
    console.error('Error fetching online ordering settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// Update online ordering settings (admin)
router.put('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const {
      isEnabled,
      freeDeliveryRadiusKm,
      paidDeliveryRadiusKm,
      deliveryCharge,
      minOrderAmount,
      allowPickup,
      allowDelivery,
      estimatedPrepTimeMinutes,
      deliveryInstructions
    } = req.body;
    
    // Check if settings exist
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    if (!settings) {
      // Create new settings
      const id = uuidv4();
      db.prepare(`
        INSERT INTO online_ordering_settings (
          id, restaurant_id, is_enabled, free_delivery_radius_km, paid_delivery_radius_km,
          delivery_charge, min_order_amount, allow_pickup, allow_delivery,
          estimated_prep_time_minutes, delivery_instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        restaurantId,
        isEnabled !== undefined ? (isEnabled ? 1 : 0) : 1,
        freeDeliveryRadiusKm ?? 5,
        paidDeliveryRadiusKm ?? 10,
        deliveryCharge ?? 0,
        minOrderAmount ?? 0,
        allowPickup !== undefined ? (allowPickup ? 1 : 0) : 1,
        allowDelivery !== undefined ? (allowDelivery ? 1 : 0) : 1,
        estimatedPrepTimeMinutes ?? 20,
        deliveryInstructions || null
      );
    } else {
      // Update existing settings
      db.prepare(`
        UPDATE online_ordering_settings SET
          is_enabled = COALESCE(?, is_enabled),
          free_delivery_radius_km = COALESCE(?, free_delivery_radius_km),
          paid_delivery_radius_km = COALESCE(?, paid_delivery_radius_km),
          delivery_charge = COALESCE(?, delivery_charge),
          min_order_amount = COALESCE(?, min_order_amount),
          allow_pickup = COALESCE(?, allow_pickup),
          allow_delivery = COALESCE(?, allow_delivery),
          estimated_prep_time_minutes = COALESCE(?, estimated_prep_time_minutes),
          delivery_instructions = COALESCE(?, delivery_instructions),
          updated_at = CURRENT_TIMESTAMP
        WHERE restaurant_id = ?
      `).run(
        isEnabled !== undefined ? (isEnabled ? 1 : 0) : null,
        freeDeliveryRadiusKm,
        paidDeliveryRadiusKm,
        deliveryCharge,
        minOrderAmount,
        allowPickup !== undefined ? (allowPickup ? 1 : 0) : null,
        allowDelivery !== undefined ? (allowDelivery ? 1 : 0) : null,
        estimatedPrepTimeMinutes,
        deliveryInstructions,
        restaurantId
      );
    }
    
    const updatedSettings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurantId);
    
    res.json({
      success: true,
      data: {
        id: updatedSettings.id,
        isEnabled: updatedSettings.is_enabled === 1,
        freeDeliveryRadiusKm: updatedSettings.free_delivery_radius_km,
        paidDeliveryRadiusKm: updatedSettings.paid_delivery_radius_km,
        deliveryCharge: updatedSettings.delivery_charge,
        minOrderAmount: updatedSettings.min_order_amount,
        allowPickup: updatedSettings.allow_pickup === 1,
        allowDelivery: updatedSettings.allow_delivery === 1,
        estimatedPrepTimeMinutes: updatedSettings.estimated_prep_time_minutes,
        deliveryInstructions: updatedSettings.delivery_instructions
      }
    });
  } catch (error) {
    console.error('Error updating online ordering settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// Get all customer online orders (admin)
router.get('/orders', authenticateToken, (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM customer_online_orders WHERE restaurant_id = ?';
    const params = [restaurantId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const orders = db.prepare(query).all(...params);
    
    // Get items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM customer_online_order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });
    
    res.json({ success: true, data: ordersWithItems });
  } catch (error) {
    console.error('Error fetching customer online orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Get single customer online order (admin)
router.get('/orders/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    const order = db.prepare(`
      SELECT * FROM customer_online_orders 
      WHERE id = ? AND restaurant_id = ?
    `).get(id, req.user.restaurantId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const items = db.prepare('SELECT * FROM customer_online_order_items WHERE order_id = ?').all(id);
    
    res.json({ success: true, data: { ...order, items } });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// Update customer online order status (admin)
router.put('/orders/:id/status', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const order = db.prepare(`
      SELECT * FROM customer_online_orders 
      WHERE id = ? AND restaurant_id = ?
    `).get(id, req.user.restaurantId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    db.prepare(`
      UPDATE customer_online_orders SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
    
    const updatedOrder = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Link customer online order to billing order (admin)
router.post('/orders/:id/link-to-billing', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { billing_order_id } = req.body;
    
    const order = db.prepare(`
      SELECT * FROM customer_online_orders 
      WHERE id = ? AND restaurant_id = ?
    `).get(id, req.user.restaurantId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Customer order not found' });
    }
    
    // Create a billing order from the customer order
    const orderId = uuidv4();
    
    db.prepare(`
      INSERT INTO orders (id, status, subtotal, tax_amount, total, created_at, updated_at)
      VALUES (?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(orderId, order.subtotal, order.tax_amount, order.total);
    
    // Link the customer order to the billing order
    db.prepare(`
      UPDATE customer_online_orders SET
        linked_order_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId, id);
    
    const updatedOrder = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedOrder, billingOrderId: orderId });
  } catch (error) {
    console.error('Error linking order to billing:', error);
    res.status(500).json({ success: false, error: 'Failed to link order to billing' });
  }
});

// Get order statistics (admin)
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    
    const counts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM customer_online_orders 
      WHERE restaurant_id = ?
      GROUP BY status
    `).all(restaurantId);
    
    const today = new Date().toISOString().split('T')[0];
    const todayRevenue = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue, COUNT(*) as orders
      FROM customer_online_orders
      WHERE restaurant_id = ? AND DATE(created_at) = ?
    `).get(restaurantId, today);
    
    const stats = {
      new: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
      todayRevenue: todayRevenue.revenue,
      todayOrders: todayRevenue.orders
    };
    
    counts.forEach(row => {
      if (stats.hasOwnProperty(row.status)) {
        stats[row.status] = row.count;
      }
      stats.total += row.count;
    });
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;