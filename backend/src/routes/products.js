import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all products
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const { categoryId, active } = req.query;

    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.restaurant_id = ?
    `;
    const params = [req.user.restaurantId];

    if (categoryId) {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    if (active !== undefined) {
      query += ' AND p.is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY c.sort_order, p.name';

    const products = db.prepare(query).all(...params);

    // Parse section_prices for each product
    res.json(products.map(p => {
      let sectionPrices = [];
      try {
        sectionPrices = JSON.parse(p.section_prices || '[]');
      } catch (e) {
        sectionPrices = [];
      }
      return {
        id: p.id,
        name: p.name,
        categoryId: p.category_id,
        categoryName: p.category_name,
        description: p.description,
        sellingPrice: p.selling_price,
        mrp: p.mrp,
        taxRate: p.tax_rate,
        isActive: p.is_active === 1,
        enableOnline: p.enable_online === 1,
        restaurantId: p.restaurant_id,
        sectionPrices,
      };
    }));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// Get single product
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;
    const product = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let sectionPrices = [];
    try {
      sectionPrices = JSON.parse(product.section_prices || '[]');
    } catch (e) {
      sectionPrices = [];
    }

    res.json({
      id: product.id,
      name: product.name,
      categoryId: product.category_id,
      categoryName: product.category_name,
      description: product.description,
      sellingPrice: product.selling_price,
      mrp: product.mrp,
      taxRate: product.tax_rate,
      isActive: product.is_active === 1,
      enableOnline: product.enable_online === 1,
      restaurantId: product.restaurant_id,
      sectionPrices,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Create product
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, categoryId, description, sellingPrice, mrp = 0, taxRate = 0, isActive = true, enableOnline = false, sectionPrices = [] } = req.body;
    const { db } = req;

    const id = uuidv4();
    const sectionPricesJson = JSON.stringify(sectionPrices);
    
    db.prepare(`
      INSERT INTO products (id, name, category_id, description, selling_price, mrp, tax_rate, is_active, enable_online, restaurant_id, section_prices)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, categoryId, description, sellingPrice, mrp, taxRate, isActive ? 1 : 0, enableOnline ? 1 : 0, req.user.restaurantId, sectionPricesJson);

    const product = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(id);

    let parsedSectionPrices = [];
    try {
      parsedSectionPrices = JSON.parse(product.section_prices || '[]');
    } catch (e) {
      parsedSectionPrices = [];
    }

    res.status(201).json({
      id: product.id,
      name: product.name,
      categoryId: product.category_id,
      categoryName: product.category_name,
      description: product.description,
      sellingPrice: product.selling_price,
      mrp: product.mrp,
      taxRate: product.tax_rate,
      isActive: product.is_active === 1,
      enableOnline: product.enable_online === 1,
      restaurantId: product.restaurant_id,
      sectionPrices: parsedSectionPrices,
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, categoryId, description, sellingPrice, mrp, taxRate, isActive, enableOnline, sectionPrices } = req.body;
    const { db } = req;

    // Build dynamic update query
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (categoryId !== undefined) { updates.push('category_id = ?'); values.push(categoryId); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (sellingPrice !== undefined) { updates.push('selling_price = ?'); values.push(sellingPrice); }
    if (mrp !== undefined) { updates.push('mrp = ?'); values.push(mrp); }
    if (taxRate !== undefined) { updates.push('tax_rate = ?'); values.push(taxRate); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (enableOnline !== undefined) { updates.push('enable_online = ?'); values.push(enableOnline ? 1 : 0); }
    if (sectionPrices !== undefined) { updates.push('section_prices = ?'); values.push(JSON.stringify(sectionPrices)); }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const product = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let parsedSectionPrices = [];
    try {
      parsedSectionPrices = JSON.parse(product.section_prices || '[]');
    } catch (e) {
      parsedSectionPrices = [];
    }

    res.json({
      id: product.id,
      name: product.name,
      categoryId: product.category_id,
      categoryName: product.category_name,
      description: product.description,
      sellingPrice: product.selling_price,
      mrp: product.mrp,
      taxRate: product.tax_rate,
      isActive: product.is_active === 1,
      enableOnline: product.enable_online === 1,
      restaurantId: product.restaurant_id,
      sectionPrices: parsedSectionPrices,
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;