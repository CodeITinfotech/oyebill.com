import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all sections
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    
    const sections = db.prepare(`
      SELECT s.*, COUNT(t.id) as table_count 
      FROM sections s 
      LEFT JOIN tables t ON s.id = t.section_id 
      WHERE s.restaurant_id = ?
      GROUP BY s.id
      ORDER BY s.name
    `).all(req.user.restaurantId);

    res.json(sections.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      isActive: s.is_active === 1,
      restaurantId: s.restaurant_id,
      tableCount: s.table_count,
    })));
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ error: 'Failed to get sections' });
  }
});

// Get single section
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.id);

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.json({
      id: section.id,
      name: section.name,
      description: section.description,
      isActive: section.is_active === 1,
      restaurantId: section.restaurant_id,
    });
  } catch (error) {
    console.error('Get section error:', error);
    res.status(500).json({ error: 'Failed to get section' });
  }
});

// Create section
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, description, isActive = true } = req.body;
    const { db } = req;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO sections (id, name, description, is_active, restaurant_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description, isActive ? 1 : 0, req.user.restaurantId);

    const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(id);

    res.status(201).json({
      id: section.id,
      name: section.name,
      description: section.description,
      isActive: section.is_active === 1,
      restaurantId: section.restaurant_id,
    });
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// Update section
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const { db } = req;

    db.prepare(`
      UPDATE sections SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, description, isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id);

    const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.id);

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.json({
      id: section.id,
      name: section.name,
      description: section.description,
      isActive: section.is_active === 1,
      restaurantId: section.restaurant_id,
    });
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// Delete section
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    // Check if section has tables
    const tables = db.prepare('SELECT COUNT(*) as count FROM tables WHERE section_id = ?').get(req.params.id);
    if (tables.count > 0) {
      return res.status(400).json({ error: 'Cannot delete section with tables. Remove tables first.' });
    }

    db.prepare('DELETE FROM sections WHERE id = ?').run(req.params.id);
    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

export default router;