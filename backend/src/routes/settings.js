import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper function to safely parse JSON
const safeParse = (val) => {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    if (typeof parsed === 'string') {
      return JSON.parse(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
};

// Helper to get table status colors
const getTableStatusColors = (db, restaurantId) => {
  const colors = db.prepare('SELECT status_key, bg, border, label FROM table_status_colors WHERE restaurant_id = ?').all(restaurantId);
  const result = {};
  for (const color of colors) {
    result[color.status_key] = {
      bg: color.bg,
      border: color.border,
      label: color.label
    };
  }
  return Object.keys(result).length > 0 ? result : null;
};

// Helper to get printer settings
const getPrinterSettings = (db, restaurantId) => {
  return db.prepare('SELECT * FROM printer_settings WHERE restaurant_id = ?').all(restaurantId);
};

// Helper to get tax setup
const getTaxSetup = (db, restaurantId) => {
  return db.prepare('SELECT * FROM tax_setup WHERE restaurant_id = ?').all(restaurantId);
};

// Helper to get bill setup
const getBillSetup = (db, restaurantId) => {
  return db.prepare('SELECT * FROM bill_setup WHERE restaurant_id = ?').get(restaurantId);
};

// Helper to get KOT setup
const getKotSetup = (db, restaurantId) => {
  return db.prepare('SELECT * FROM kot_setup WHERE restaurant_id = ?').get(restaurantId);
};

// Helper to get user rights
const getUserRights = (db, restaurantId) => {
  return db.prepare('SELECT * FROM user_rights WHERE restaurant_id = ?').all(restaurantId);
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

    // Get data from new tables
    const tableStatusColors = getTableStatusColors(db, req.user.restaurantId);
    const printerSettings = getPrinterSettings(db, req.user.restaurantId);
    const taxSetup = getTaxSetup(db, req.user.restaurantId);
    const billSetup = getBillSetup(db, req.user.restaurantId);
    const kotSetup = getKotSetup(db, req.user.restaurantId);
    const userRights = getUserRights(db, req.user.restaurantId);

    res.json({
      restaurantId: settings.restaurant_id,
      cgstRate: settings.cgst_rate,
      sgstRate: settings.sgst_rate,
      defaultTaxRate: settings.default_tax_rate,
      priceInclusiveTax: settings.price_inclusive_tax === 1,
      kotPrinters: printerSettings.filter(p => p.printer_type === 'kot'),
      billPrinters: printerSettings.filter(p => p.printer_type === 'bill'),
      defaultKotPrinter: settings.kot_printer,
      billPrinter: settings.bill_printer,
      printCopies: settings.print_copies,
      skipLinesBeforeCut: settings.skip_lines_before_cut || 3,
      taxName: settings.tax_name || 'GST',
      isActive: settings.is_active === 1,
      printerSettings,
      taxSetup,
      billSetup,
      kotSetup,
      userRights,
      tableStatusColors,
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
      taxName, isActive, printerSettings, taxSetup, billSetup, kotSetup, userRights, tableStatusColors
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
        is_active = COALESCE(?, is_active)
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
      req.user.restaurantId
    );

    // Update printer settings
    if (printerSettings && Array.isArray(printerSettings)) {
      for (const printer of printerSettings) {
        db.prepare(`
          INSERT INTO printer_settings (id, restaurant_id, printer_name, printer_type, printer_ip, printer_port, is_default, paper_width)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            printer_name = excluded.printer_name,
            printer_type = excluded.printer_type,
            printer_ip = excluded.printer_ip,
            printer_port = excluded.printer_port,
            is_default = excluded.is_default,
            paper_width = excluded.paper_width
        `).run(
          printer.id || uuidv4(),
          req.user.restaurantId,
          printer.printer_name,
          printer.printer_type,
          printer.printer_ip,
          printer.printer_port || 9100,
          printer.is_default ? 1 : 0,
          printer.paper_width || 80
        );
      }
    }

    // Update tax setup
    if (taxSetup && Array.isArray(taxSetup)) {
      for (const tax of taxSetup) {
        db.prepare(`
          INSERT INTO tax_setup (id, restaurant_id, tax_name, tax_rate, tax_type, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            tax_name = excluded.tax_name,
            tax_rate = excluded.tax_rate,
            tax_type = excluded.tax_type,
            is_active = excluded.is_active
        `).run(
          tax.id || uuidv4(),
          req.user.restaurantId,
          tax.tax_name,
          tax.tax_rate,
          tax.tax_type || 'combined',
          tax.is_active ? 1 : 0
        );
      }
    }

    // Update bill setup
    if (billSetup) {
      db.prepare(`
        INSERT INTO bill_setup (id, restaurant_id, header_text, footer_text, show_logo, show_qr, qr_data, show_tax_breakup, show_waiter, show_table, show_order_no, paper_size, font_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(restaurant_id) DO UPDATE SET
          header_text = excluded.header_text,
          footer_text = excluded.footer_text,
          show_logo = excluded.show_logo,
          show_qr = excluded.show_qr,
          qr_data = excluded.qr_data,
          show_tax_breakup = excluded.show_tax_breakup,
          show_waiter = excluded.show_waiter,
          show_table = excluded.show_table,
          show_order_no = excluded.show_order_no,
          paper_size = excluded.paper_size,
          font_size = excluded.font_size
      `).run(
        uuidv4(),
        req.user.restaurantId,
        billSetup.header_text,
        billSetup.footer_text,
        billSetup.show_logo ? 1 : 0,
        billSetup.show_qr ? 1 : 0,
        billSetup.qr_data,
        billSetup.show_tax_breakup ? 1 : 0,
        billSetup.show_waiter ? 1 : 0,
        billSetup.show_table ? 1 : 0,
        billSetup.show_order_no ? 1 : 0,
        billSetup.paper_size || '80mm',
        billSetup.font_size || 12
      );
    }

    // Update KOT setup
    if (kotSetup) {
      db.prepare(`
        INSERT INTO kot_setup (id, restaurant_id, header_text, footer_text, show_logo, show_category, show_item_notes, show_modifiers, paper_size, font_size, auto_print, print_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(restaurant_id) DO UPDATE SET
          header_text = excluded.header_text,
          footer_text = excluded.footer_text,
          show_logo = excluded.show_logo,
          show_category = excluded.show_category,
          show_item_notes = excluded.show_item_notes,
          show_modifiers = excluded.show_modifiers,
          paper_size = excluded.paper_size,
          font_size = excluded.font_size,
          auto_print = excluded.auto_print,
          print_count = excluded.print_count
      `).run(
        uuidv4(),
        req.user.restaurantId,
        kotSetup.header_text,
        kotSetup.footer_text,
        kotSetup.show_logo ? 1 : 0,
        kotSetup.show_category ? 1 : 0,
        kotSetup.show_item_notes ? 1 : 0,
        kotSetup.show_modifiers ? 1 : 0,
        kotSetup.paper_size || '80mm',
        kotSetup.font_size || 12,
        kotSetup.auto_print ? 1 : 0,
        kotSetup.print_count || 1
      );
    }

    // Update user rights
    if (userRights && Array.isArray(userRights)) {
      for (const rights of userRights) {
        db.prepare(`
          INSERT INTO user_rights (id, restaurant_id, role, can_take_orders, can_print_kot, can_print_bill, can_void_order, can_apply_discount, can_give_complimentary, can_view_reports, can_manage_products, can_manage_users, can_manage_settings, can_refund)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            role = excluded.role,
            can_take_orders = excluded.can_take_orders,
            can_print_kot = excluded.can_print_kot,
            can_print_bill = excluded.can_print_bill,
            can_void_order = excluded.can_void_order,
            can_apply_discount = excluded.can_apply_discount,
            can_give_complimentary = excluded.can_give_complimentary,
            can_view_reports = excluded.can_view_reports,
            can_manage_products = excluded.can_manage_products,
            can_manage_users = excluded.can_manage_users,
            can_manage_settings = excluded.can_manage_settings,
            can_refund = excluded.can_refund
        `).run(
          rights.id || uuidv4(),
          req.user.restaurantId,
          rights.role,
          rights.can_take_orders ? 1 : 0,
          rights.can_print_kot ? 1 : 0,
          rights.can_print_bill ? 1 : 0,
          rights.can_void_order ? 1 : 0,
          rights.can_apply_discount ? 1 : 0,
          rights.can_give_complimentary ? 1 : 0,
          rights.can_view_reports ? 1 : 0,
          rights.can_manage_products ? 1 : 0,
          rights.can_manage_users ? 1 : 0,
          rights.can_manage_settings ? 1 : 0,
          rights.can_refund ? 1 : 0
        );
      }
    }

    // Update table status colors
    if (tableStatusColors && typeof tableStatusColors === 'object') {
      for (const [statusKey, colorData] of Object.entries(tableStatusColors)) {
        db.prepare(`
          INSERT INTO table_status_colors (id, restaurant_id, status_key, bg, border, label)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(restaurant_id, status_key) DO UPDATE SET
            bg = excluded.bg,
            border = excluded.border,
            label = excluded.label
        `).run(uuidv4(), req.user.restaurantId, statusKey, colorData.bg, colorData.border, colorData.label);
      }
    }

    // Return updated settings
    const settings = db.prepare('SELECT * FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    const tableStatusColorsResult = getTableStatusColors(db, req.user.restaurantId);
    const printerSettingsResult = getPrinterSettings(db, req.user.restaurantId);
    const taxSetupResult = getTaxSetup(db, req.user.restaurantId);
    const billSetupResult = getBillSetup(db, req.user.restaurantId);
    const kotSetupResult = getKotSetup(db, req.user.restaurantId);
    const userRightsResult = getUserRights(db, req.user.restaurantId);

    res.json({
      restaurantId: settings.restaurant_id,
      cgstRate: settings.cgst_rate,
      sgstRate: settings.sgst_rate,
      defaultTaxRate: settings.default_tax_rate,
      priceInclusiveTax: settings.price_inclusive_tax === 1,
      kotPrinters: printerSettingsResult.filter(p => p.printer_type === 'kot'),
      billPrinters: printerSettingsResult.filter(p => p.printer_type === 'bill'),
      defaultKotPrinter: settings.kot_printer,
      billPrinter: settings.bill_printer,
      printCopies: settings.print_copies,
      skipLinesBeforeCut: settings.skip_lines_before_cut || 3,
      taxName: settings.tax_name || 'GST',
      isActive: settings.is_active === 1,
      printerSettings: printerSettingsResult,
      taxSetup: taxSetupResult,
      billSetup: billSetupResult,
      kotSetup: kotSetupResult,
      userRights: userRightsResult,
      tableStatusColors: tableStatusColorsResult,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
