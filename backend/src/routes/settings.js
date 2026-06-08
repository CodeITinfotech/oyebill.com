import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper function to safely parse JSON
const safeParse = (val) => {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    // Handle double-encoded JSON
    if (typeof parsed === 'string') {
      return JSON.parse(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
};

// Get settings
router.get('/', authenticateToken, (req, res) => {
  try {
    const { db } = req;

    let settings = db.prepare('SELECT * FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);

    if (!settings) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO settings (id, restaurant_id)
        VALUES (?, ?)
      `).run(id, req.user.restaurantId);

      settings = db.prepare('SELECT * FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    }

    res.json({
      restaurantId: settings.restaurant_id,
      cgstRate: settings.cgst_rate,
      sgstRate: settings.sgst_rate,
      defaultTaxRate: settings.default_tax_rate,
      priceInclusiveTax: settings.price_inclusive_tax === 1,
      kotPrinter: settings.kot_printer,
      billPrinter: settings.bill_printer,
      printCopies: settings.print_copies,
      skipLinesBeforeCut: settings.skip_lines_before_cut || 3,
      taxName: settings.tax_name || 'GST',
      isActive: settings.is_active === 1,
      kot_setup: safeParse(settings.kot_setup),
      bill_setup: safeParse(settings.bill_setup),
      userRights: safeParse(settings.user_rights),
      payment: safeParse(settings.payment),
      tableStatusColors: safeParse(settings.table_status_colors),
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
router.put('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { 
      cgstRate, sgstRate, defaultTaxRate, priceInclusiveTax, 
      kotPrinter, billPrinter, printCopies, skipLinesBeforeCut,
      taxName, isActive, kot_setup, bill_setup, userRights, payment, tableStatusColors
    } = req.body;
    const { db } = req;

    db.prepare(`
      UPDATE settings SET
        cgst_rate = COALESCE(?, cgst_rate),
        sgst_rate = COALESCE(?, sgst_rate),
        default_tax_rate = COALESCE(?, default_tax_rate),
        price_inclusive_tax = COALESCE(?, price_inclusive_tax),
        kot_printer = COALESCE(?, kot_printer),
        bill_printer = COALESCE(?, bill_printer),
        print_copies = COALESCE(?, print_copies),
        skip_lines_before_cut = COALESCE(?, skip_lines_before_cut),
        tax_name = COALESCE(?, tax_name),
        is_active = COALESCE(?, is_active),
        kot_setup = COALESCE(?, kot_setup),
        bill_setup = COALESCE(?, bill_setup),
        user_rights = COALESCE(?, user_rights),
        payment = COALESCE(?, payment),
        table_status_colors = COALESCE(?, table_status_colors)
      WHERE restaurant_id = ?
    `).run(
      cgstRate,
      sgstRate,
      defaultTaxRate,
      priceInclusiveTax !== undefined ? (priceInclusiveTax ? 1 : 0) : null,
      kotPrinter,
      billPrinter,
      printCopies,
      skipLinesBeforeCut,
      taxName,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      kot_setup ? JSON.stringify(kot_setup) : null,
      bill_setup ? JSON.stringify(bill_setup) : null,
      userRights ? JSON.stringify(userRights) : null,
      payment ? JSON.stringify(payment) : null,
      tableStatusColors ? JSON.stringify(tableStatusColors) : null,
      req.user.restaurantId
    );

    const settings = db.prepare('SELECT * FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);

    res.json({
      restaurantId: settings.restaurant_id,
      cgstRate: settings.cgst_rate,
      sgstRate: settings.sgst_rate,
      defaultTaxRate: settings.default_tax_rate,
      priceInclusiveTax: settings.price_inclusive_tax === 1,
      kotPrinter: settings.kot_printer,
      billPrinter: settings.bill_printer,
      printCopies: settings.print_copies,
      skipLinesBeforeCut: settings.skip_lines_before_cut || 3,
      taxName: settings.tax_name || 'GST',
      isActive: settings.is_active === 1,
      kot_setup: safeParse(settings.kot_setup),
      bill_setup: safeParse(settings.bill_setup),
      userRights: safeParse(settings.user_rights),
      payment: safeParse(settings.payment),
      tableStatusColors: safeParse(settings.table_status_colors),
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
