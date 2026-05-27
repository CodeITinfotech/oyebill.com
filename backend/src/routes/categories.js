import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all categories
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.category_id 
      WHERE c.restaurant_id = ?
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `).all(req.user.restaurantId);

    res.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sort_order,
      isActive: c.is_active === 1,
      restaurantId: c.restaurant_id,
      productCount: c.product_count,
    })));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Get single category
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      id: category.id,
      name: category.name,
      description: category.description,
      sortOrder: category.sort_order,
      isActive: category.is_active === 1,
      restaurantId: category.restaurant_id,
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

// Create category
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, description, isActive = true } = req.body;
    const { db } = req;

    // Get max sort order
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM categories WHERE restaurant_id = ?').get(req.user.restaurantId);
    const sortOrder = (maxOrder.max || 0) + 1;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO categories (id, name, description, sort_order, is_active, restaurant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description, sortOrder, isActive ? 1 : 0, req.user.restaurantId);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

    res.status(201).json({
      id: category.id,
      name: category.name,
      description: category.description,
      sortOrder: category.sort_order,
      isActive: category.is_active === 1,
      restaurantId: category.restaurant_id,
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update category
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, description, isActive, sortOrder } = req.body;
    const { db } = req;

    db.prepare(`
      UPDATE categories SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(name, description, isActive !== undefined ? (isActive ? 1 : 0) : null, sortOrder, req.params.id);

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      id: category.id,
      name: category.name,
      description: category.description,
      sortOrder: category.sort_order,
      isActive: category.is_active === 1,
      restaurantId: category.restaurant_id,
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    // Check if category has products
    const products = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(req.params.id);
    if (products.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products. Remove products first.' });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;