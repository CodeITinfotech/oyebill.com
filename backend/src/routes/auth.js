import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { db } = req;

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Get restaurant
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(user.restaurant_id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurant_id,
      mustResetPassword: user.must_reset_password === 1,
      isActive: user.is_active === 1,
    };

    res.json({
      user: userResponse,
      token,
      restaurant: restaurant ? {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        gstNumber: restaurant.gst_number,
        fssaiNumber: restaurant.fssai_number,
        logo: restaurant.logo,
      } : null,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(user.restaurant_id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurant_id,
        mustResetPassword: user.must_reset_password === 1,
        isActive: user.is_active === 1,
      },
      restaurant: restaurant ? {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        gstNumber: restaurant.gst_number,
        fssaiNumber: restaurant.fssai_number,
        logo: restaurant.logo,
      } : null,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Change password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { db } = req;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Reset password (first login)
router.post('/reset-password', authenticateToken, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { db } = req;

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, must_reset_password = 0 WHERE id = ?')
      .run(hashedPassword, req.user.id);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Forgot password - send reset link
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { db } = req;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(404).json({ error: 'Email not found. Please check your email address.' });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?')
      .run(resetToken, resetExpiry.toISOString(), user.id);

    // In production, send email here. For now, return success.
    // const resetLink = `https://oyebill.com/reset-password?token=${resetToken}`;
    
    res.json({ 
      message: 'Password reset instructions sent to your email',
      // Include token for demo purposes (remove in production)
      demoResetToken: resetToken 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password request' });
  }
});

// Verify reset token
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    const { db } = req;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Check if token is expired
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Reset password with token
router.post('/reset-password-with-token', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const { db } = req;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters' });
    }

    const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Check if token is expired
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Clear reset token and update password
    db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, must_reset_password = 0 WHERE id = ?')
      .run(hashedPassword, user.id);

    res.json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password with token error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Register new restaurant
router.post('/register-restaurant', async (req, res) => {
  try {
    const { restaurant, admin } = req.body;
    const { db } = req;

    // Validate required fields
    if (!restaurant?.name || !admin?.name || !admin?.email || !admin?.password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (admin.password.length < 5) {
      return res.status(400).json({ error: 'Password must be at least 5 characters' });
    }

    // Check if admin email already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(admin.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please use a different email.' });
    }

    // Create restaurant
    const restaurantId = uuidv4();
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    
    db.prepare(`
      INSERT INTO restaurants (id, name, address, phone, email, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).run(
      restaurantId,
      restaurant.name,
      restaurant.address || '',
      restaurant.phone || '',
      restaurant.email || ''
    );

    // Create admin user (status pending until approved by super admin)
    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, restaurant_id, status, must_reset_password, is_active, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?, 'pending', 0, 0, datetime('now'))
    `).run(userId, admin.name, admin.email, hashedPassword, restaurantId);

    res.status(201).json({ 
      message: 'Registration submitted successfully. You will receive an email once your account is activated.',
      restaurantId,
      userId
    });
  } catch (error) {
    console.error('Register restaurant error:', error);
    res.status(500).json({ error: 'Failed to register restaurant' });
  }
});

// PIN Login (for waiters and bussers only)
router.post('/pin-login', async (req, res) => {
  try {
    const { pin, restaurantId } = req.body;
    const { db } = req;

    if (!pin || pin.length !== 4) {
      return res.status(400).json({ error: 'PIN must be 4 digits' });
    }

    // Find user with matching PIN and role (waiter/busser only)
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE pin = ? 
        AND role IN ('waiter', 'busser') 
        AND is_active = 1
        AND pin_failed_attempts < 3
        AND restaurant_id = ?
    `).get(pin, restaurantId);

    if (!user) {
      // Check if PIN exists but user is locked
      const lockedUser = db.prepare(`
        SELECT * FROM users 
        WHERE pin = ? 
          AND role IN ('waiter', 'busser')
          AND is_active = 1
          AND pin_failed_attempts >= 3
          AND restaurant_id = ?
      `).get(pin, restaurantId);

      if (lockedUser) {
        return res.status(423).json({ 
          error: 'Account locked. Please login with password to unlock.',
          requiresPassword: true,
          userId: lockedUser.id
        });
      }

      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Reset failed attempts on successful login
    db.prepare('UPDATE users SET pin_failed_attempts = 0 WHERE id = ?').run(user.id);

    // Get restaurant
    const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(user.restaurant_id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurant_id,
      pinEnabled: true,
      isActive: user.is_active === 1,
    };

    res.json({
      user: userResponse,
      token,
      restaurant: restaurant ? {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        gstNumber: restaurant.gst_number,
        fssaiNumber: restaurant.fssai_number,
        logo: restaurant.logo,
      } : null,
      pinLogin: true
    });
  } catch (error) {
    console.error('PIN login error:', error);
    res.status(500).json({ error: 'PIN login failed' });
  }
});

// Set PIN (after first password login)
router.post('/set-pin', authenticateToken, (req, res) => {
  try {
    const { pin } = req.body;
    const { db } = req;

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    // Only allow for waiters and bussers
    if (!['waiter', 'busser'].includes(req.user.role)) {
      return res.status(403).json({ error: 'PIN can only be set for waiters and bussers' });
    }

    // Check if PIN is already used by another user
    const existingUser = db.prepare(`
      SELECT * FROM users 
      WHERE pin = ? AND id != ? AND restaurant_id = ?
    `).get(pin, req.user.id, req.user.restaurantId);

    if (existingUser) {
      return res.status(400).json({ error: 'PIN already in use by another user' });
    }

    db.prepare('UPDATE users SET pin = ?, pin_failed_attempts = 0 WHERE id = ?')
      .run(pin, req.user.id);

    res.json({ message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

// Reset PIN (requires password login)
router.post('/reset-pin', authenticateToken, (req, res) => {
  try {
    const { password, newPin } = req.body;
    const { db } = req;

    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const validPassword = bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if new PIN is already used by another user
    const existingUser = db.prepare(`
      SELECT * FROM users 
      WHERE pin = ? AND id != ? AND restaurant_id = ?
    `).get(newPin, req.user.id, req.user.restaurantId);

    if (existingUser) {
      return res.status(400).json({ error: 'PIN already in use by another user' });
    }

    db.prepare('UPDATE users SET pin = ?, pin_failed_attempts = 0 WHERE id = ?')
      .run(newPin, req.user.id);

    res.json({ message: 'PIN reset successfully' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
});

// Unlock PIN after 3 failed attempts (requires password)
router.post('/unlock-pin', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const { db } = req;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Reset failed attempts
    db.prepare('UPDATE users SET pin_failed_attempts = 0 WHERE id = ?').run(user.id);

    res.json({ message: 'PIN unlocked successfully', pin: user.pin });
  } catch (error) {
    console.error('Unlock PIN error:', error);
    res.status(500).json({ error: 'Failed to unlock PIN' });
  }
});

// Track failed PIN attempts
router.post('/pin-failed', (req, res) => {
  try {
    const { pin, restaurantId } = req.body;
    const { db } = req;

    const user = db.prepare(`
      SELECT * FROM users 
      WHERE pin = ? 
        AND role IN ('waiter', 'busser') 
        AND is_active = 1
        AND restaurant_id = ?
    `).get(pin, restaurantId);

    if (user) {
      const newAttempts = user.pin_failed_attempts + 1;
      db.prepare('UPDATE users SET pin_failed_attempts = ? WHERE id = ?')
        .run(newAttempts, user.id);
      
      if (newAttempts >= 3) {
        return res.json({ 
          locked: true, 
          attempts: newAttempts,
          message: 'Account locked. Please login with password to unlock.'
        });
      }
      
      return res.json({ 
        locked: false, 
        attempts: newAttempts,
        remaining: 3 - newAttempts
      });
    }
    
    res.json({ error: 'User not found' });
  } catch (error) {
    console.error('PIN failed error:', error);
    res.status(500).json({ error: 'Failed to track PIN attempt' });
  }
});

export default router;