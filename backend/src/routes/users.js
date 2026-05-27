import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.restaurant_id, u.must_reset_password, u.is_active, u.created_at
      FROM users u
      WHERE u.restaurant_id = ?
      ORDER BY u.created_at DESC
    `).all(req.user.restaurantId);

    res.json(users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      restaurantId: u.restaurant_id,
      mustResetPassword: u.must_reset_password === 1,
      isActive: u.is_active === 1,
      createdAt: u.created_at,
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get single user
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    
    // Users can only see their own profile or admins can see anyone
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Cannot view other users' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurant_id,
      mustResetPassword: user.must_reset_password === 1,
      isActive: user.is_active === 1,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, mustResetPassword = true } = req.body;
    const { db } = req;

    // Check if email exists
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();

    db.prepare(`
      INSERT INTO users (id, name, email, password, role, restaurant_id, must_reset_password, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, name, email, hashedPassword, role, req.user.restaurantId, mustResetPassword ? 1 : 0);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurant_id,
      mustResetPassword: user.must_reset_password === 1,
      isActive: user.is_active === 1,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, email, role, isActive, mustResetPassword } = req.body;
    const { db } = req;

    // Check permissions
    const isSelfUpdate = req.user.id === req.params.id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelfUpdate && !isAdmin) {
      return res.status(403).json({ error: 'Cannot update other users' });
    }

    // Only admin can change role and active status
    if (!isAdmin) {
      if (role !== undefined || isActive !== undefined) {
        return res.status(403).json({ error: 'Only admin can change role or active status' });
      }
    }

    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        must_reset_password = COALESCE(?, must_reset_password)
      WHERE id = ?
    `).run(
      name,
      email,
      isAdmin ? role : null,
      isAdmin && isActive !== undefined ? (isActive ? 1 : 0) : null,
      mustResetPassword !== undefined ? (mustResetPassword ? 1 : 0) : null,
      req.params.id
    );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurant_id,
      mustResetPassword: user.must_reset_password === 1,
      isActive: user.is_active === 1,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;

    // Cannot delete self
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;