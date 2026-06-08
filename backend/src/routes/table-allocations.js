import express from 'express';
import crypto from 'crypto';
import db from '../../database/index.js';

const router = express.Router();

// Get all table-waiter allocations
router.get('/', (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    let query = `
      SELECT 
        twa.*,
        t.number as table_number,
        u.name as waiter_name,
        u.role as waiter_role
      FROM table_waiter_allocations twa
      JOIN tables t ON twa.table_id = t.id
      JOIN users u ON twa.waiter_id = u.id
      WHERE twa.is_active = 1
    `;
    
    const params = [];
    if (restaurantId) {
      query += ' AND t.restaurant_id = ?';
      params.push(restaurantId);
    }
    
    query += ' ORDER BY t.number';
    
    const allocations = db.prepare(query).all(...params);
    res.json({ success: true, data: allocations });
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch allocations' });
  }
});

// Get tables allocated to a specific waiter
router.get('/waiter/:waiterId', (req, res) => {
  try {
    const { waiterId } = req.params;
    
    const tables = db.prepare(`
      SELECT 
        t.*,
        twa.id as allocation_id
      FROM table_waiter_allocations twa
      JOIN tables t ON twa.table_id = t.id
      WHERE twa.waiter_id = ? AND twa.is_active = 1
      ORDER BY t.number
    `).all(waiterId);
    
    res.json({ success: true, data: tables });
  } catch (error) {
    console.error('Error fetching waiter tables:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch waiter tables' });
  }
});

// Get waiters allocated to a specific table
router.get('/table/:tableId', (req, res) => {
  try {
    const { tableId } = req.params;
    
    const waiters = db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.role
      FROM table_waiter_allocations twa
      JOIN users u ON twa.waiter_id = u.id
      WHERE twa.table_id = ? AND twa.is_active = 1
      ORDER BY u.name
    `).all(tableId);
    
    res.json({ success: true, data: waiters });
  } catch (error) {
    console.error('Error fetching table waiters:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch table waiters' });
  }
});

// Allocate a waiter to a table
router.post('/', (req, res) => {
  try {
    const { tableId, waiterId } = req.body;
    
    if (!tableId || !waiterId) {
      return res.status(400).json({ success: false, error: 'Table ID and Waiter ID are required' });
    }
    
    // Check if allocation already exists
    const existing = db.prepare(`
      SELECT id FROM table_waiter_allocations 
      WHERE table_id = ? AND waiter_id = ? AND is_active = 1
    `).get(tableId, waiterId);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Allocation already exists' });
    }
    
    const id = crypto.randomUUID();
    
    db.prepare(`
      INSERT INTO table_waiter_allocations (id, table_id, waiter_id, is_active)
      VALUES (?, ?, ?, 1)
    `).run(id, tableId, waiterId);
    
    res.json({ success: true, data: { id, tableId, waiterId } });
  } catch (error) {
    console.error('Error creating allocation:', error);
    res.status(500).json({ success: false, error: 'Failed to create allocation' });
  }
});

// Update allocation (change waiter)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { waiterId, isActive } = req.body;
    
    const updates = [];
    const params = [];
    
    if (waiterId !== undefined) {
      updates.push('waiter_id = ?');
      params.push(waiterId);
    }
    
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    db.prepare(`
      UPDATE table_waiter_allocations 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating allocation:', error);
    res.status(500).json({ success: false, error: 'Failed to update allocation' });
  }
});

// Remove allocation (deactivate)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    db.prepare(`
      UPDATE table_waiter_allocations 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting allocation:', error);
    res.status(500).json({ success: false, error: 'Failed to delete allocation' });
  }
});

// Bulk allocate tables to waiters
router.post('/bulk', (req, res) => {
  try {
    const { allocations } = req.body; // Array of { tableId, waiterId }
    
    if (!Array.isArray(allocations)) {
      return res.status(400).json({ success: false, error: 'Allocations must be an array' });
    }
    
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO table_waiter_allocations (id, table_id, waiter_id, is_active)
      VALUES (?, ?, ?, 1)
    `);
    
    const deactivateStmt = db.prepare(`
      UPDATE table_waiter_allocations 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE table_id = ?
    `);
    
    const transaction = db.transaction(() => {
      for (const alloc of allocations) {
        if (alloc.tableId && alloc.waiterId) {
          // Deactivate existing allocations for this table
          deactivateStmt.run(alloc.tableId);
          // Insert new allocation
          insertStmt.run(crypto.randomUUID(), alloc.tableId, alloc.waiterId);
        }
      }
    });
    
    transaction();
    
    res.json({ success: true, message: 'Allocations updated successfully' });
  } catch (error) {
    console.error('Error bulk allocating:', error);
    res.status(500).json({ success: false, error: 'Failed to update allocations' });
  }
});

export default router;