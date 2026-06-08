import express from 'express';
import db from '../../database/index.js';

const router = express.Router();

// Get notifications for a waiter
router.get('/waiter/:waiterId', (req, res) => {
  try {
    const { waiterId } = req.params;
    const { unreadOnly } = req.query;
    
    let query = `
      SELECT n.*, t.number as table_number
      FROM waiter_notifications n
      LEFT JOIN tables t ON n.table_id = t.id
      WHERE n.waiter_id = ?
    `;
    
    if (unreadOnly === 'true') {
      query += ' AND n.is_read = 0';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT 50';
    
    const notifications = db.prepare(query).all(waiterId);
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/waiter/:waiterId/unread-count', (req, res) => {
  try {
    const { waiterId } = req.params;
    
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM waiter_notifications 
      WHERE waiter_id = ? AND is_read = 0
    `).get(waiterId);
    
    res.json({ success: true, data: { count: result.count } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch count' });
  }
});

// Mark notification as read
router.put('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    
    db.prepare(`
      UPDATE waiter_notifications 
      SET is_read = 1 
      WHERE id = ?
    `).run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

// Mark all notifications as read for a waiter
router.put('/waiter/:waiterId/read-all', (req, res) => {
  try {
    const { waiterId } = req.params;
    
    db.prepare(`
      UPDATE waiter_notifications 
      SET is_read = 1 
      WHERE waiter_id = ? AND is_read = 0
    `).run(waiterId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Failed to update notifications' });
  }
});

// Acknowledge notification (for accept/decline actions)
router.put('/:id/acknowledge', (req, res) => {
  try {
    const { id } = req.params;
    
    db.prepare(`
      UPDATE waiter_notifications 
      SET is_acknowledged = 1, is_read = 1 
      WHERE id = ?
    `).run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging notification:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
});

// Delete old notifications (cleanup)
router.delete('/cleanup', (req, res) => {
  try {
    const { daysOld = 7 } = req.query;
    
    const result = db.prepare(`
      DELETE FROM waiter_notifications 
      WHERE created_at < datetime('now', '-' || ? || ' days')
        AND is_read = 1
        AND is_acknowledged = 1
    `).run(parseInt(daysOld));
    
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup notifications' });
  }
});

export default router;