import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../../database/index.js';

const router = express.Router();

// Generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
router.post('/send-otp', (req, res) => {
  try {
    const { email, name, phone } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Delete any existing OTPs for this email
    db.prepare('DELETE FROM customer_otp WHERE email = ?').run(email);
    
    // Insert new OTP
    db.prepare(`
      INSERT INTO customer_otp (id, email, otp, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), email.toLowerCase(), otp, expiresAt.toISOString());
    
    // In production, you would send the OTP via email service
    // For now, we'll return it in the response (for testing)
    // In production, use a proper email service like SendGrid, Mailgun, etc.
    
    console.log(`[OTP] Sending to ${email}: ${otp}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // Remove this in production - only for testing
      otp: otp,
      expires_in: 600 // seconds
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }
    
    // Find the OTP record
    const otpRecord = db.prepare(`
      SELECT * FROM customer_otp 
      WHERE email = ? AND otp = ? AND is_verified = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(email.toLowerCase(), otp);
    
    if (!otpRecord) {
      return res.status(400).json({ success: false, error: 'Invalid OTP or OTP already used' });
    }
    
    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'OTP has expired' });
    }
    
    // Mark OTP as verified
    db.prepare('UPDATE customer_otp SET is_verified = 1 WHERE id = ?').run(otpRecord.id);
    
    // Find or create customer account
    let customerAccount = db.prepare('SELECT * FROM customer_accounts WHERE email = ?').get(email.toLowerCase());
    
    if (!customerAccount) {
      // Create new customer account
      const customerId = uuidv4();
      const restaurantId = req.body.restaurant_id || null;
      
      db.prepare(`
        INSERT INTO customer_accounts (id, name, email, phone, restaurant_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(customerId, req.body.name || 'Customer', email.toLowerCase(), req.body.phone || null, restaurantId);
      
      customerAccount = db.prepare('SELECT * FROM customer_accounts WHERE id = ?').get(customerId);
    }
    
    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      customer: {
        id: customerAccount.id,
        name: customerAccount.name,
        email: customerAccount.email,
        phone: customerAccount.phone
      }
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
});

// Get customer profile
router.get('/profile/:email', (req, res) => {
  try {
    const { email } = req.params;
    
    const customer = db.prepare('SELECT * FROM customer_accounts WHERE email = ?').get(email.toLowerCase());
    
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer profile' });
  }
});

// Update customer profile
router.put('/profile/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, default_order_type } = req.body;
    
    const customer = db.prepare('SELECT * FROM customer_accounts WHERE id = ?').get(id);
    
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    db.prepare(`
      UPDATE customer_accounts SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        default_order_type = COALESCE(?, default_order_type),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, address, default_order_type, id);
    
    const updatedCustomer = db.prepare('SELECT * FROM customer_accounts WHERE id = ?').get(id);
    
    res.json({ success: true, data: updatedCustomer });
  } catch (error) {
    console.error('Error updating customer profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update customer profile' });
  }
});

export default router;