import express from 'express';
import db from '../../database/index.js';

const router = express.Router();

// Public bill view - no authentication required
// Returns bill data that can be rendered as a PDF-like view
router.get('/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order with items
    const order = db.prepare(`
      SELECT o.*, t.number as table_number, u.name as waiter_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      LEFT JOIN restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ?
    `).get(orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Bill not found' });
    }
    
    // Get order items
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.tax_rate
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);
    
    // Get restaurant settings
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(order.restaurant_id);
    
    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    
    const itemsWithTax = items.map(item => {
      const itemTotal = item.price * item.quantity;
      const taxAmount = itemTotal * (item.tax_rate || 0) / 100;
      subtotal += itemTotal;
      totalTax += taxAmount;
      
      return {
        productName: item.product_name || item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        taxRate: item.tax_rate || 0,
        taxAmount: taxAmount,
        total: itemTotal + taxAmount
      };
    });
    
    const total = subtotal + totalTax;
    
    // Get discount if any
    let discount = 0;
    if (order.discount_amount) {
      discount = order.discount_amount;
    }
    
    const grandTotal = total - discount;
    
    // Convert to words
    const numberToWords = (num) => {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
        'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      
      if (num === 0) return 'Zero';
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
      return num.toString();
    };
    
    const totalInWords = numberToWords(Math.floor(grandTotal)) + ' Rupees';
    
    // Build bill data object
    const billData = {
      orderId: order.id,
      tableNumber: order.table_number || 'N/A',
      dateTime: new Date(order.created_at).toLocaleString('en-IN'),
      waiterName: order.waiter_name || 'N/A',
      customerPhone: order.customer_phone || '',
      items: itemsWithTax,
      subtotal: subtotal,
      taxAmount: totalTax,
      discount: discount,
      loyaltyDiscount: 0,
      total: grandTotal,
      totalInWords: totalInWords,
      restaurant: {
        name: restaurant?.name || 'Restaurant',
        address: restaurant?.address || '',
        phone: restaurant?.phone || '',
        gstin: restaurant?.gstin || ''
      }
    };
    
    res.json({
      success: true,
      data: billData
    });
  } catch (error) {
    console.error('Error fetching bill:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bill' });
  }
});

export default router;