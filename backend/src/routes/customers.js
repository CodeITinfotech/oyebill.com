import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all customers
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const customers = db.prepare(`
      SELECT * FROM customers 
      WHERE restaurant_id = ? AND is_active = 1 
      ORDER BY name ASC
    `).all(req.user.restaurantId);

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get single customer
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const customer = db.prepare(`
      SELECT * FROM customers WHERE id = ? AND restaurant_id = ?
    `).get(req.params.id, req.user.restaurantId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create customer
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, phone, email, place, foodPreference, loyaltyDiscount } = req.body;
    const { db } = req;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check for duplicate phone or email
    if (phone) {
      const existingPhone = db.prepare(`
        SELECT id FROM customers WHERE phone = ? AND restaurant_id = ?
      `).get(phone, req.user.restaurantId);
      if (existingPhone) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
    }

    if (email) {
      const existingEmail = db.prepare(`
        SELECT id FROM customers WHERE email = ? AND restaurant_id = ?
      `).get(email, req.user.restaurantId);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO customers (id, name, phone, email, place, food_preference, loyalty_discount, restaurant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, phone || null, email || null, place || null, foodPreference || 'both', loyaltyDiscount || 0, req.user.restaurantId);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, phone, email, place, foodPreference, loyaltyDiscount, isActive } = req.body;
    const { db } = req;

    const existing = db.prepare(`
      SELECT * FROM customers WHERE id = ? AND restaurant_id = ?
    `).get(req.params.id, req.user.restaurantId);

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check for duplicate phone
    if (phone && phone !== existing.phone) {
      const existingPhone = db.prepare(`
        SELECT id FROM customers WHERE phone = ? AND restaurant_id = ? AND id != ?
      `).get(phone, req.user.restaurantId, req.params.id);
      if (existingPhone) {
        return res.status(400).json({ error: 'Phone number already exists' });
      }
    }

    // Check for duplicate email
    if (email && email !== existing.email) {
      const existingEmail = db.prepare(`
        SELECT id FROM customers WHERE email = ? AND restaurant_id = ? AND id != ?
      `).get(email, req.user.restaurantId, req.params.id);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = ?, email = ?, place = ?, food_preference = ?, loyalty_discount = ?, is_active = ?
      WHERE id = ?
    `).run(
      name || existing.name,
      phone || null,
      email || null,
      place || null,
      foodPreference || existing.food_preference,
      loyaltyDiscount ?? existing.loyalty_discount,
      isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
      req.params.id
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer (soft delete)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;

    const existing = db.prepare(`
      SELECT * FROM customers WHERE id = ? AND restaurant_id = ?
    `).get(req.params.id, req.user.restaurantId);

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;