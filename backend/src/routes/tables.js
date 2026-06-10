import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Clear all tables - reset to available and delete active orders
router.post('/clear-all', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    const restaurantId = req.user.restaurantId;
    
    // Get all table IDs for this restaurant
    const tables = db.prepare('SELECT id FROM tables WHERE restaurant_id = ?').all(restaurantId);
    const tableIds = tables.map(t => t.id);
    
    if (tableIds.length === 0) {
      return res.json({ success: true, message: 'No tables found', cleared: 0 });
    }
    
    // Set all tables to available
    const placeholders = tableIds.map(() => '?').join(',');
    db.prepare(`UPDATE tables SET status = 'available' WHERE id IN (${placeholders})`).run(...tableIds);
    
    // Delete active orders for these tables
    const orderPlaceholders = tableIds.map(() => '?').join(',');
    const deletedOrders = db.prepare(`DELETE FROM orders WHERE table_id IN (${orderPlaceholders}) AND status NOT IN ('paid', 'cancelled')`).run(...tableIds);
    
    res.json({ 
      success: true, 
      message: 'All tables cleared',
      clearedTables: tableIds.length,
      deletedOrders: deletedOrders.changes
    });
  } catch (error) {
    console.error('Clear tables error:', error);
    res.status(500).json({ error: 'Failed to clear tables' });
  }
});

// Clear a specific table
router.post('/clear/:tableId', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { db } = req;
    const { tableId } = req.params;
    
    // Verify table belongs to restaurant
    const table = db.prepare('SELECT * FROM tables WHERE id = ? AND restaurant_id = ?').get(tableId, req.user.restaurantId);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }
    
    // Set table to available
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('available', tableId);
    
    // Delete active orders for this table
    const deletedOrders = db.prepare(`DELETE FROM orders WHERE table_id = ? AND status NOT IN ('paid', 'cancelled')`).run(tableId);
    
    res.json({ 
      success: true, 
      message: `Table ${table.number} cleared`,
      tableNumber: table.number,
      deletedOrders: deletedOrders.changes
    });
  } catch (error) {
    console.error('Clear table error:', error);
    res.status(500).json({ error: 'Failed to clear table' });
  }
});

// Get all tables
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const { sectionId } = req.query;

    let query = `
      SELECT t.*, s.name as section_name 
      FROM tables t 
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.restaurant_id = ?
    `;
    const params = [req.user.restaurantId];

    if (sectionId) {
      query += ' AND t.section_id = ?';
      params.push(sectionId);
    }

    query += ' ORDER BY t.number';

    const tables = db.prepare(query).all(...params);

    res.json(tables.map(t => ({
      id: t.id,
      number: t.number,
      sectionId: t.section_id,
      sectionName: t.section_name,
      capacity: t.capacity,
      status: t.status,
      restaurantId: t.restaurant_id,
    })));
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ error: 'Failed to get tables' });
  }
});

// Get tables pending cleaning (for busser) - MUST be before /:id route
router.get('/pending-cleaning', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    
    const tables = db.prepare(`
      SELECT t.*, s.name as section_name 
      FROM tables t 
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.restaurant_id = ? AND t.status = 'pending_cleaning'
      ORDER BY t.number
    `).all(req.user.restaurantId);

    res.json(tables.map(t => ({
      id: t.id,
      number: t.number,
      sectionId: t.section_id,
      sectionName: t.section_name,
      capacity: t.capacity,
      status: t.status,
      restaurantId: t.restaurant_id,
    })));
  } catch (error) {
    console.error('Get pending cleaning tables error:', error);
    res.status(500).json({ error: 'Failed to get pending cleaning tables' });
  }
});

// Get single table
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const table = db.prepare(`
      SELECT t.*, s.name as section_name 
      FROM tables t 
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.id = ? AND t.restaurant_id = ?
    `).get(req.params.id, req.user.restaurantId);

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    res.json({
      id: table.id,
      number: table.number,
      sectionId: table.section_id,
      sectionName: table.section_name,
      capacity: table.capacity,
      status: table.status,
      restaurantId: table.restaurant_id,
    });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({ error: 'Failed to get table' });
  }
});

// Create table
router.post('/', authenticateToken, (req, res) => {
  try {
    // Accept both camelCase and snake_case
    const table_number = req.body.table_number || req.body.number;
    const section_id = req.body.section_id || req.body.sectionId;
    const capacity = req.body.capacity || 4;
    const { db } = req;

    if (!table_number || !section_id) {
      return res.status(400).json({ error: 'Table number and section are required' });
    }

    // Check if table number already exists in restaurant
    const existing = db.prepare('SELECT * FROM tables WHERE number = ? AND restaurant_id = ?').get(table_number, req.user.restaurantId);
    if (existing) {
      return res.status(400).json({ error: 'Table number already exists' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO tables (id, number, section_id, capacity, status, restaurant_id)
      VALUES (?, ?, ?, ?, 'available', ?)
    `).run(id, table_number, section_id, capacity, req.user.restaurantId);

    const table = db.prepare(`
      SELECT t.*, s.name as section_name 
      FROM tables t 
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.id = ?
    `).get(id);

    res.status(201).json({
      id: table.id,
      number: table.number,
      sectionId: table.section_id,
      sectionName: table.section_name,
      capacity: table.capacity,
      status: table.status,
      restaurantId: table.restaurant_id,
    });
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// Update table
router.put('/:id', authenticateToken, (req, res) => {
  try {
    // Accept both camelCase and snake_case
    const number = req.body.number || req.body.table_number;
    const sectionId = req.body.sectionId || req.body.section_id;
    const capacity = req.body.capacity;
    const status = req.body.status;
    const { db } = req;

    // Check for duplicate table number
    if (number) {
      const existing = db.prepare('SELECT * FROM tables WHERE number = ? AND restaurant_id = ? AND id != ?')
        .get(number, req.user.restaurantId, req.params.id);
      if (existing) {
        return res.status(400).json({ error: 'Table number already exists' });
      }
    }

    db.prepare(`
      UPDATE tables SET
        number = COALESCE(?, number),
        section_id = COALESCE(?, section_id),
        capacity = COALESCE(?, capacity),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(number, sectionId, capacity, status, req.params.id);

    const table = db.prepare(`
      SELECT t.*, s.name as section_name 
      FROM tables t 
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    res.json({
      id: table.id,
      number: table.number,
      sectionId: table.section_id,
      sectionName: table.section_name,
      capacity: table.capacity,
      status: table.status,
      restaurantId: table.restaurant_id,
    });
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// Delete table (clears associated KOTs and bills, keeps table)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const tableId = req.params.id;

    // Get table info
    const table = db.prepare('SELECT * FROM tables WHERE id = ? AND restaurant_id = ?').get(tableId, req.user.restaurantId);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    // Get all order IDs for this table
    const orders = db.prepare('SELECT id FROM orders WHERE table_id = ?').all(tableId);
    
    // Delete order items first (due to foreign key constraints)
    for (const order of orders) {
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);
    }
    
    // Delete all orders (KOTs and bills) for this table
    const deletedOrders = db.prepare('DELETE FROM orders WHERE table_id = ?').run(tableId);

    // Set table to available
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('available', tableId);

    res.json({ 
      success: true, 
      message: `Deleted ${deletedOrders.changes} orders for Table ${table.number}`,
      deletedOrders: deletedOrders.changes,
      tableNumber: table.number
    });
  } catch (error) {
    console.error('Delete table orders error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete table orders' });
  }
});

// Mark table as cleaned (set to available)
router.put('/:id/mark-cleaned', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Only allow marking as cleaned if status is pending_cleaning
    if (table.status !== 'pending_cleaning') {
      return res.status(400).json({ error: 'Table is not pending cleaning' });
    }

    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('available', req.params.id);

    const updatedTable = db.prepare(`
      SELECT t.*, s.name as section_name 
      FROM tables t 
      LEFT JOIN sections s ON t.section_id = s.id
      WHERE t.id = ?
    `).get(req.params.id);

    res.json({
      id: updatedTable.id,
      number: updatedTable.number,
      sectionId: updatedTable.section_id,
      sectionName: updatedTable.section_name,
      capacity: updatedTable.capacity,
      status: updatedTable.status,
      restaurantId: updatedTable.restaurant_id,
    });
  } catch (error) {
    console.error('Mark table cleaned error:', error);
    res.status(500).json({ error: 'Failed to mark table as cleaned' });
  }
});

// Sync all table statuses based on orders (fixes stale statuses)
// DISABLED: This was causing tables to incorrectly change status
// Table status should ONLY change during explicit order operations
router.post('/sync-status', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    // Get all tables with their order status
    const tables = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM orders WHERE table_id = t.id AND status != 'billed') as active_orders,
        (SELECT COUNT(*) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.table_id = t.id AND oi.is_kot = 1 AND o.status != 'billed') as kot_items
      FROM tables t
      WHERE t.restaurant_id = ?
    `).all(req.user.restaurantId);

    let updated = 0;
    for (const table of tables) {
      // DON'T update any table status automatically
      // Status should only change during explicit operations (add items, generate KOT, generate bill)
      // This prevents incorrect status changes based on stale order data
    }

    res.json({ 
      success: true, 
      message: 'Sync disabled - status changes only during explicit operations',
      updated: 0
    });
  } catch (error) {
    console.error('Sync table status error:', error);
    res.status(500).json({ error: 'Failed to sync table statuses' });
  }
});

// Separate endpoint to migrate old status values
router.post('/migrate-status', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    // Map old status values to new ones
    const migrations = [
      { old: 'occupied', new: 'available' },
      { old: 'active', new: 'active_kot' },
      { old: 'reserved', new: 'available' },
    ];

    let updated = 0;
    for (const { old, new: newStatus } of migrations) {
      const result = db.prepare('UPDATE tables SET status = ? WHERE status = ? AND restaurant_id = ?')
        .run(newStatus, old, req.user.restaurantId);
      updated += result.changes;
    }

    res.json({ 
      success: true, 
      message: `Migrated ${updated} table statuses`,
      updated 
    });
  } catch (error) {
    console.error('Migrate table status error:', error);
    res.status(500).json({ error: 'Failed to migrate table statuses' });
  }
});

export default router;