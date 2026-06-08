import express from 'express';

const router = express.Router();

// In-memory notifications store (for demo - can be stored in DB)
const notifications = [];

// Send notification to bussers
router.post('/notify', (req, res) => {
  try {
    const { tableId, tableNumber, message } = req.body;
    
    if (!tableId || !tableNumber) {
      return res.status(400).json({ success: false, error: 'tableId and tableNumber are required' });
    }
    
    const notification = {
      id: Date.now().toString(),
      tableId,
      tableNumber,
      message: message || `Table ${tableNumber} needs cleaning!`,
      type: 'cleaning_reminder',
      createdAt: new Date().toISOString(),
      read: false
    };
    
    notifications.push(notification);
    
    console.log(`🔔 Busser notification sent: ${notification.message}`);
    
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error sending busser notification:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
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