import express from 'express';
import db from '../../database/index.js';

const router = express.Router();

// In-memory notifications store (for demo - can be stored in DB)
const notifications = [];

// Send notification to bussers
router.post('/notify', (req, res) => {
  try {
    const { tableId, tableNumber, message, busserId } = req.body;
    
    if (!tableId || !tableNumber) {
      return res.status(400).json({ success: false, error: 'tableId and tableNumber are required' });
    }
    
    const notification = {
      id: Date.now().toString(),
      tableId,
      tableNumber,
      message: message || `Table ${tableNumber} needs cleaning!`,
      type: 'cleaning_reminder',
      busserId: busserId || null, // null means all bussers
      createdAt: new Date().toISOString(),
      read: false
    };
    
    notifications.push(notification);
    
    const target = busserId ? `busser ${busserId}` : 'all bussers';
    console.log(`🔔 Busser notification sent to ${target}: ${notification.message}`);
    
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error sending busser notification:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
  }
});

// Mark table as available after cleaning
router.post('/mark-available', (req, res) => {
  try {
    const { tableId } = req.body;
    
    if (!tableId) {
      return res.status(400).json({ success: false, error: 'tableId is required' });
    }
    
    // Check if table exists and is in pending_cleaning status
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(tableId);
    
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }
    
    if (table.status !== 'pending_cleaning') {
      return res.status(400).json({ success: false, error: 'Table is not pending cleaning' });
    }
    
    // Check if there's an active order for this table
    const activeOrder = db.prepare(`
      SELECT id FROM orders WHERE table_id = ? AND status != 'billed' LIMIT 1
    `).get(tableId);
    
    if (activeOrder) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot mark table as available - there is still an active order' 
      });
    }
    
    // Mark table as available
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run('available', tableId);
    
    console.log(`✅ Table ${table.number} marked as available after cleaning`);
    
    res.json({ success: true, message: 'Table marked as available', tableId });
  } catch (error) {
    console.error('Error marking table as available:', error);
    res.status(500).json({ success: false, error: 'Failed to mark table as available' });
  }
});

// Get pending notifications
router.get('/notifications', (req, res) => {
  try {
    const unreadNotifications = notifications.filter(n => !n.read);
    res.json({ success: true, data: unreadNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const notification = notifications.find(n => n.id === id);
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    notification.read = true;
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

export default router;