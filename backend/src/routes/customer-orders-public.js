import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database/index.js';

const router = express.Router();

// Helper function to map online order item from DB to API format
function mapOnlineOrderItem(item) {
  return {
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    taxRate: item.tax_rate,
    taxAmount: item.tax_amount,
    total: item.total,
    notes: item.notes,
    cookingInstructions: item.cooking_instructions || null,
    modifiers: item.modifiers ? JSON.parse(item.modifiers) : [],
  };
}

// Generate order number
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// Calculate tax amounts
function calculateTaxes(subtotal, taxRate) {
  return subtotal * (taxRate / 100);
}

// Place a new customer order
router.post('/', (req, res) => {
  try {
    const { 
      restaurant_id,
      customer_account_id,
      customer_name,
      customer_email,
      customer_phone,
      delivery_address,
      order_type,
      delivery_distance_km,
      items,
      payment_method,
      special_instructions
    } = req.body;
    
    if (!restaurant_id || !customer_name || !customer_email || !customer_phone || !order_type || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: restaurant_id, customer_name, customer_email, customer_phone, order_type, items' 
      });
    }
    
    if (!['pickup', 'delivery'].includes(order_type)) {
      return res.status(400).json({ success: false, error: 'Invalid order_type. Must be "pickup" or "delivery"' });
    }
    
    if (order_type === 'delivery' && !delivery_address) {
      return res.status(400).json({ success: false, error: 'Delivery address is required for delivery orders' });
    }
    
    // Get online ordering settings
    let settings = db.prepare('SELECT * FROM online_ordering_settings WHERE restaurant_id = ?').get(restaurant_id);
    
    if (!settings || settings.is_enabled !== 1) {
      return res.status(400).json({ success: false, error: 'Online ordering is not enabled for this restaurant' });
    }
    
    // Check delivery range for delivery orders
    if (order_type === 'delivery') {
      const paidRadius = settings.paid_delivery_radius_km || 10;
      if (delivery_distance_km > paidRadius) {
        return res.status(400).json({ 
          success: false, 
          error: `Delivery not available beyond ${paidRadius}km. Please select pickup instead.`,
          maxRadius: paidRadius
        });
      }
    }
    
    // Calculate delivery charge
    let deliveryCharge = 0;
    const freeRadius = settings.free_delivery_radius_km || 5;
    if (order_type === 'delivery' && delivery_distance_km > freeRadius) {
      deliveryCharge = settings.delivery_charge || 0;
    }
    
    // Calculate subtotal from items
    let subtotal = 0;
    let totalTax = 0;
    
    const orderItems = items.map(item => {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND enable_online = 1 AND is_active = 1').get(item.product_id);
      
      if (!product) {
        throw new Error(`Product not found or not available for online ordering: ${item.product_id}`);
      }
      
      const quantity = item.quantity || 1;
      const unitPrice = product.selling_price;
      const itemTotal = unitPrice * quantity;
      const taxAmount = calculateTaxes(itemTotal, product.tax_rate || 0);
      
      // Handle modifiers
      const modifiersJson = item.modifiers ? JSON.stringify(item.modifiers) : null;
      
      subtotal += itemTotal;
      totalTax += taxAmount;
      
      return {
        id: uuidv4(),
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        tax_rate: product.tax_rate || 0,
        tax_amount: taxAmount,
        total: itemTotal,
        notes: item.notes || null,
        cooking_instructions: item.cookingInstructions || null,
        modifiers: modifiersJson
      };
    });
    
    // Calculate total
    const discountAmount = 0; // Can be extended with discount logic
    const total = subtotal + totalTax + deliveryCharge - discountAmount;
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    const orderId = uuidv4();
    
    // Calculate estimated ready time
    const prepTimeMinutes = settings.estimated_prep_time_minutes || 20;
    const estimatedReadyTime = new Date(Date.now() + prepTimeMinutes * 60 * 1000);
    
    // Insert order
    db.prepare(`
      INSERT INTO customer_online_orders (
        id, order_number, customer_account_id, customer_name, customer_email, customer_phone,
        delivery_address, order_type, delivery_distance_km, delivery_charge,
        subtotal, tax_amount, discount_amount, total,
        payment_method, payment_status, status,
        estimated_ready_time, special_instructions, restaurant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      orderNumber,
      customer_account_id || null,
      customer_name,
      customer_email.toLowerCase(),
      customer_phone,
      delivery_address || null,
      order_type,
      delivery_distance_km || null,
      deliveryCharge,
      subtotal,
      totalTax,
      discountAmount,
      total,
      payment_method || 'pay_at_restaurant',
      'pending',
      'new',
      estimatedReadyTime.toISOString(),
      special_instructions || null,
      restaurant_id
    );
    
    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO customer_online_order_items (id, order_id, product_id, product_name, quantity, unit_price, tax_rate, tax_amount, total, notes, cooking_instructions, modifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const item of orderItems) {
      insertItem.run(
        item.id,
        orderId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.tax_rate,
        item.tax_amount,
        item.total,
        item.notes,
        item.cooking_instructions,
        item.modifiers
      );
    }
    
    // Fetch the complete order
    const order = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(orderId);
    const orderItemsList = db.prepare('SELECT * FROM customer_online_order_items WHERE order_id = ?').all(orderId);
    
    res.status(201).json({
      success: true,
      data: {
        ...order,
        items: orderItemsList.map(mapOnlineOrderItem),
        restaurant: {
          name: db.prepare('SELECT name FROM restaurants WHERE id = ?').get(restaurant_id)?.name
        }
      }
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to place order' });
  }
});

// Get order by order number (for tracking)
router.get('/track/:orderNumber', (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    const order = db.prepare('SELECT * FROM customer_online_orders WHERE order_number = ?').get(orderNumber);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    const items = db.prepare('SELECT * FROM customer_online_order_items WHERE order_id = ?').all(order.id);
    const restaurant = db.prepare('SELECT id, name, address, phone FROM restaurants WHERE id = ?').get(order.restaurant_id);
    
    res.json({
      success: true,
      data: {
        ...order,
        items: items.map(mapOnlineOrderItem),
        restaurant
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

// Get order by email (for customer to view their orders)
router.get('/by-email/:email', (req, res) => {
  try {
    const { email } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    const orders = db.prepare(`
      SELECT * FROM customer_online_orders 
      WHERE customer_email = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(email.toLowerCase(), parseInt(limit), parseInt(offset));
    
    // Get items for each order
    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM customer_online_order_items WHERE order_id = ?').all(order.id);
      return { ...order, items: items.map(mapOnlineOrderItem) };
    });
    
    res.json({
      success: true,
      data: ordersWithItems
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

// Update payment status
router.post('/:orderId/payment', (req, res) => {
  try {
    const { orderId } = req.params;
    const { payment_status, payment_method } = req.body;
    
    const order = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    db.prepare(`
      UPDATE customer_online_orders SET
        payment_status = COALESCE(?, payment_status),
        payment_method = COALESCE(?, payment_method),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(payment_status, payment_method, orderId);
    
    const updatedOrder = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(orderId);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment' });
  }
});

// Cancel order
router.post('/:orderId/cancel', (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    
    const order = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Only allow cancellation of new orders
    if (order.status !== 'new') {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel order. Order is already being prepared or has been completed.' 
      });
    }
    
    db.prepare(`
      UPDATE customer_online_orders SET
        status = 'cancelled',
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, orderId);
    
    const updatedOrder = db.prepare('SELECT * FROM customer_online_orders WHERE id = ?').get(orderId);
    
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order' });
  }
});

export default router;