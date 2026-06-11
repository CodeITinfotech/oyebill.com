import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Check if setup is needed
router.get('/status', (req, res) => {
  try {
    const { db } = req;
    
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    
    if (users.count === 0) {
      res.json({ needsSetup: true });
    } else {
      const restaurant = db.prepare('SELECT * FROM restaurants LIMIT 1').get();
      res.json({ needsSetup: false, restaurant });
    }
  } catch (error) {
    console.error('Check setup error:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

// Generate QR codes for all tables
router.get('/generate-qr', (req, res) => {
  try {
    const { db } = req;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Get all tables with their section info
    const tables = db.prepare(`
      SELECT t.id, t.number, t.capacity, s.name as section_name
      FROM tables t
      LEFT JOIN sections s ON t.section_id = s.id
      ORDER BY t.number
    `).all();
    
    if (tables.length === 0) {
      return res.status(404).json({ error: 'No tables found' });
    }
    
    // Generate QR code URLs for each table
    const qrCodes = tables.map(table => ({
      tableNumber: table.number,
      section: table.section_name || 'General',
      capacity: table.capacity,
      url: `${baseUrl}/order/${table.number}`
    }));
    
    // Check if client accepts HTML (browser request)
    const acceptHeader = req.get('Accept') || '';
    const wantsHtml = acceptHeader.includes('text/html');
    
    if (wantsHtml) {
      // Return HTML page for printing
      const qrCodeItems = qrCodes.map(qr => `
        <div class="qr-card">
          <div class="qr-code">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr.url)}" alt="QR Code for Table ${qr.tableNumber}" />
          </div>
          <div class="qr-info">
            <h2>Table ${qr.tableNumber}</h2>
            <p>${qr.section} | ${qr.capacity} seats</p>
          </div>
        </div>
      `).join('\n');
      
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Table QR Codes</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            h1 { text-align: center; margin-bottom: 20px; color: #333; }
            .container { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
            .qr-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .qr-code { margin-bottom: 15px; }
            .qr-code img { width: 180px; height: 180px; border-radius: 8px; }
            .qr-info h2 { font-size: 1.5rem; color: #333; margin-bottom: 5px; }
            .qr-info p { color: #666; font-size: 0.9rem; }
            .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }
            .print-btn:hover { background: #2563eb; }
            @media print { .print-btn { display: none; } .container { display: grid; grid-template-columns: repeat(3, 1fr); } }
          </style>
        </head>
        <body>
          <h1>Table QR Codes</h1>
          <div class="container">
            ${qrCodeItems}
          </div>
          <button class="print-btn" onclick="window.print()">Print QR Codes</button>
        </body>
        </html>
      `);
    } else {
      // Return JSON for API clients
      res.json({
        success: true,
        count: qrCodes.length,
        qrCodes: qrCodes,
        message: 'QR codes generated successfully. Use a QR code generator to create printable codes.'
      });
    }
  } catch (error) {
    console.error('Generate QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR codes' });
  }
});

// Initial setup
router.post('/initial', async (req, res) => {
  try {
    const { restaurant, admin } = req.body;
    const { db } = req;

    // Check if already set up
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (users.count > 0) {
      return res.status(400).json({ error: 'System already set up' });
    }

    // Create restaurant
    const restaurantId = uuidv4();
    db.prepare(`
      INSERT INTO restaurants (id, name, address, phone, email, gst_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(restaurantId, restaurant.name, restaurant.address || '', restaurant.phone || '', restaurant.email || '', restaurant.gstNumber || '');

    // Create admin user
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    const adminId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, name, email, password, role, restaurant_id, must_reset_password, is_active)
      VALUES (?, ?, ?, ?, 'admin', ?, 0, 1)
    `).run(adminId, admin.name, admin.email, hashedPassword, restaurantId);

    // Create default settings
    const settingsId = uuidv4();
    db.prepare(`
      INSERT INTO settings (id, restaurant_id)
      VALUES (?, ?)
    `).run(settingsId, restaurantId);

    // Create some sample data
    // Categories
    const categories = [
      { name: 'Starters', desc: 'Appetizers and starters' },
      { name: 'Main Course', desc: 'Main dishes and curries' },
      { name: 'Biryani & Rice', desc: 'Rice dishes and biryanis' },
      { name: 'Beverages', desc: 'Drinks and beverages' },
      { name: 'Desserts', desc: 'Sweet dishes and desserts' },
    ];

    const categoryIds = {};
    categories.forEach((cat, index) => {
      const catId = uuidv4();
      db.prepare(`
        INSERT INTO categories (id, name, description, sort_order, is_active, restaurant_id)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(catId, cat.name, cat.desc, index + 1, restaurantId);
      categoryIds[cat.name] = catId;
    });

    // Sections
    const sections = [
      { name: 'AC Hall', desc: 'Air conditioned dining hall' },
      { name: 'Outdoor', desc: 'Outdoor seating area' },
      { name: 'Bar', desc: 'Bar and lounge' },
    ];

    const sectionIds = {};
    sections.forEach((sec) => {
      const secId = uuidv4();
      db.prepare(`
        INSERT INTO sections (id, name, description, is_active, restaurant_id)
        VALUES (?, ?, ?, 1, ?)
      `).run(secId, sec.name, sec.desc, restaurantId);
      sectionIds[sec.name] = secId;
    });

    // Products
    const products = [
      { name: 'Paneer Tikka', cat: 'Starters', price: 250, tax: 18 },
      { name: 'Chicken Lolipop', cat: 'Starters', price: 280, tax: 18 },
      { name: 'Veg Spring Roll', cat: 'Starters', price: 180, tax: 18 },
      { name: 'Samosa (2 Pcs)', cat: 'Starters', price: 80, tax: 5 },
      { name: 'Butter Chicken', cat: 'Main Course', price: 320, tax: 18 },
      { name: 'Paneer Butter Masala', cat: 'Main Course', price: 260, tax: 18 },
      { name: 'Dal Makhani', cat: 'Main Course', price: 220, tax: 5 },
      { name: 'Mix Veg Curry', cat: 'Main Course', price: 200, tax: 5 },
      { name: 'Chicken Biryani', cat: 'Biryani & Rice', price: 350, tax: 18 },
      { name: 'Veg Biryani', cat: 'Biryani & Rice', price: 250, tax: 18 },
      { name: 'Jeera Rice', cat: 'Biryani & Rice', price: 120, tax: 5 },
      { name: 'Plain Rice', cat: 'Biryani & Rice', price: 100, tax: 0 },
      { name: 'Masala Chai', cat: 'Beverages', price: 50, tax: 0 },
      { name: 'Cold Coffee', cat: 'Beverages', price: 120, tax: 18 },
      { name: 'Fresh Lime Soda', cat: 'Beverages', price: 80, tax: 5 },
      { name: 'Water Bottle', cat: 'Beverages', price: 20, tax: 0 },
      { name: 'Gulab Jamun (2 Pcs)', cat: 'Desserts', price: 100, tax: 0 },
      { name: 'Ice Cream (2 Scoops)', cat: 'Desserts', price: 150, tax: 18 },
      { name: 'Rasmalai (2 Pcs)', cat: 'Desserts', price: 120, tax: 5 },
    ];

    products.forEach((prod) => {
      const mrp = Math.round(prod.price * 1.1 * 100) / 100;
      db.prepare(`
        INSERT INTO products (id, name, category_id, description, selling_price, mrp, tax_rate, is_active, enable_online, restaurant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
      `).run(uuidv4(), prod.name, categoryIds[prod.cat], `Fresh ${prod.name.toLowerCase()}`, prod.price, mrp, prod.tax, restaurantId);
    });

    // Tables
    const tables = [
      { number: '1', section: 'AC Hall', capacity: 4 },
      { number: '2', section: 'AC Hall', capacity: 4 },
      { number: '3', section: 'AC Hall', capacity: 6 },
      { number: '4', section: 'AC Hall', capacity: 2 },
      { number: '5', section: 'Outdoor', capacity: 4 },
      { number: '6', section: 'Outdoor', capacity: 6 },
      { number: '7', section: 'Bar', capacity: 2 },
      { number: '8', section: 'Bar', capacity: 4 },
    ];

    tables.forEach((table) => {
      db.prepare(`
        INSERT INTO tables (id, number, section_id, capacity, status, restaurant_id)
        VALUES (?, ?, ?, ?, 'available', ?)
      `).run(uuidv4(), table.number, sectionIds[table.section], table.capacity, restaurantId);
    });

    // Create default table status colors
    const defaultStatuses = [
      { key: 'available', bg: '#22c55e', border: '#16a34a', label: 'Available' },
      { key: 'active_kot', bg: '#f97316', border: '#ea580c', label: 'Active KOT' },
      { key: 'pending_billing', bg: '#ef4444', border: '#dc2626', label: 'Pending Billing' },
      { key: 'pending_cleaning', bg: '#6b7280', border: '#4b5563', label: 'Pending Cleaning' }
    ];
    for (const status of defaultStatuses) {
      db.prepare(`
        INSERT OR IGNORE INTO table_status_colors (id, restaurant_id, status_key, bg, border, label)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), restaurantId, status.key, status.bg, status.border, status.label);
    }

    res.json({ message: 'Setup completed successfully', restaurantId });
  } catch (error) {
    console.error('Initial setup error:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

export default router;