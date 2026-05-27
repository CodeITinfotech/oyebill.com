import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all restaurants
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const restaurants = db.prepare('SELECT * FROM restaurants ORDER BY name').all();
    
    res.json(restaurants.map(r => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      email: r.email,
      gstNumber: r.gst_number,
      fssaiNumber: r.fssai_number,
      logo: r.logo,
    })));
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ error: 'Failed to get restaurants' });
  }
});

// Get single restaurant
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      gstNumber: restaurant.gst_number,
      fssaiNumber: restaurant.fssai_number,
      logo: restaurant.logo,
    });
  } catch (error) {
    console.error('Get restaurant error:', error);
    res.status(500).json({ error: 'Failed to get restaurant' });
  }
});

// Create restaurant (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, address, phone, email, gstNumber, fssaiNumber } = req.body;
    const { db } = req;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO restaurants (id, name, address, phone, email, gst_number, fssai_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, address, phone, email, gstNumber, fssaiNumber);

    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
    
    res.status(201).json({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      gstNumber: restaurant.gst_number,
      fssaiNumber: restaurant.fssai_number,
      logo: restaurant.logo,
    });
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

// Update restaurant
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, address, phone, email, gstNumber, fssaiNumber } = req.body;
    const { db } = req;

    db.prepare(`
      UPDATE restaurants SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        gst_number = COALESCE(?, gst_number),
        fssai_number = COALESCE(?, fssai_number)
      WHERE id = ?
    `).run(name, address, phone, email, gstNumber, fssaiNumber, req.params.id);

    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(req.params.id);
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      gstNumber: restaurant.gst_number,
      fssaiNumber: restaurant.fssai_number,
      logo: restaurant.logo,
    });
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

// Delete restaurant
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    
    // Check if restaurant has users
    const users = db.prepare('SELECT COUNT(*) as count FROM users WHERE restaurant_id = ?').get(req.params.id);
    if (users.count > 0) {
      return res.status(400).json({ error: 'Cannot delete restaurant with users' });
    }

    db.prepare('DELETE FROM restaurants WHERE id = ?').run(req.params.id);
    res.json({ message: 'Restaurant deleted successfully' });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

export default router;