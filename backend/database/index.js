import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

// Helper function for generating UUIDs
const uuidv4 = () => randomUUID().toString();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'oyebill.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Migration: Create performance indexes if they don't exist
try {
  const indexesToCreate = [
    'CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id)',
    'CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id)',
    'CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id)',
    'CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id)',
    'CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id)',
    'CREATE INDEX IF NOT EXISTS idx_sections_restaurant ON sections(restaurant_id)'
  ];
  
  for (const idx of indexesToCreate) {
    db.exec(idx);
  }
  console.log('Performance indexes created');
} catch (err) {
  console.log('Index migration note:', err.message);
}

// Migration: Add missing columns to orders table
try {
  const tableInfo = db.prepare("PRAGMA table_info(orders)").all();
  const existingColumns = tableInfo.map(col => col.name);
  
  const columnsToAdd = [
    { name: 'waiter_id', type: 'TEXT' },
    { name: 'customer_id', type: 'TEXT' },
    { name: 'loyalty_discount', type: 'REAL DEFAULT 0' },
    { name: 'linked_customer_order_id', type: 'TEXT' }
  ];
  
  for (const col of columnsToAdd) {
    if (!existingColumns.includes(col.name)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} column to orders table`);
    }
  }
} catch (err) {
  console.log('Orders migration note:', err.message);
}

// Migration: Add modifiers and cooking_instructions columns to order_items
try {
  const tableInfo = db.prepare("PRAGMA table_info(order_items)").all();
  const existingColumns = tableInfo.map(col => col.name);
  
  const columnsToAdd = [
    { name: 'cooking_instructions', type: 'TEXT' },
    { name: 'modifiers', type: 'TEXT' }  // JSON string for modifiers array
  ];
  
  for (const col of columnsToAdd) {
    if (!existingColumns.includes(col.name)) {
      db.exec(`ALTER TABLE order_items ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} column to order_items table`);
    }
  }
} catch (err) {
  console.log('Order items modifiers migration note:', err.message);
}

// Migration: Add modifiers and cooking_instructions columns to customer_order_items
try {
  const tableInfo = db.prepare("PRAGMA table_info(customer_order_items)").all();
  const existingColumns = tableInfo.map(col => col.name);
  
  const columnsToAdd = [
    { name: 'cooking_instructions', type: 'TEXT' },
    { name: 'modifiers', type: 'TEXT' }  // JSON string for modifiers array
  ];
  
  for (const col of columnsToAdd) {
    if (!existingColumns.includes(col.name)) {
      db.exec(`ALTER TABLE customer_order_items ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} column to customer_order_items table`);
    }
  }
} catch (err) {
  console.log('Customer order items modifiers migration note:', err.message);
}

// Migration: Add modifiers and cooking_instructions columns to customer_online_order_items
try {
  const tableInfo = db.prepare("PRAGMA table_info(customer_online_order_items)").all();
  const existingColumns = tableInfo.map(col => col.name);
  
  const columnsToAdd = [
    { name: 'cooking_instructions', type: 'TEXT' },
    { name: 'modifiers', type: 'TEXT' }  // JSON string for modifiers array
  ];
  
  for (const col of columnsToAdd) {
    if (!existingColumns.includes(col.name)) {
      db.exec(`ALTER TABLE customer_online_order_items ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} column to customer_online_order_items table`);
    }
  }
} catch (err) {
  console.log('Customer online order items modifiers migration note:', err.message);
}

// Migration: Create product_section_prices table and remove section_prices from products
try {
  // Create product_section_prices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_section_prices (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      section_id TEXT NOT NULL,
      price REAL NOT NULL,
      restaurant_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, section_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
  `);
  console.log('Created product_section_prices table');
} catch (err) {
  console.log('Product section prices table creation note:', err.message);
}

// Migration: Remove tax_name from settings (use tax_setup table instead)
try {
  const tableInfo = db.prepare("PRAGMA table_info(settings)").all();
  const existingColumns = tableInfo.map(col => col.name);
  
  if (existingColumns.includes('tax_name')) {
    db.exec("ALTER TABLE settings DROP COLUMN tax_name");
    console.log('Removed tax_name column from settings table');
  }
} catch (err) {
  console.log('Settings tax_name migration note:', err.message);
}

// Migration: Create online_orders_data table and remove order_data from online_orders
try {
  // Create online_orders_data table
  db.exec(`
    CREATE TABLE IF NOT EXISTS online_orders_data (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      data_key TEXT NOT NULL,
      data_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES online_orders(id) ON DELETE CASCADE,
      UNIQUE(order_id, data_key)
    )
  `);
  console.log('Created online_orders_data table');
  
  // Check if order_data column exists in online_orders and migrate data
  const orderInfo = db.prepare("PRAGMA table_info(online_orders)").all();
  const hasOrderData = orderInfo.some(col => col.name === 'order_data');
  
  if (hasOrderData) {
    // Migrate existing order_data to new table
    const ordersWithData = db.prepare("SELECT id, order_data FROM online_orders WHERE order_data IS NOT NULL").all();
    
    for (const order of ordersWithData) {
      try {
        const parsedData = JSON.parse(order.order_data);
        if (typeof parsedData === 'object' && parsedData !== null) {
          for (const [key, value] of Object.entries(parsedData)) {
            db.prepare(`
              INSERT INTO online_orders_data (id, order_id, data_key, data_value)
              VALUES (?, ?, ?, ?)
            `).run(uuidv4(), order.id, key, JSON.stringify(value));
          }
        }
      } catch (e) {
        console.log('Failed to migrate order_data for order:', order.id);
      }
    }
    
    // Remove order_data column
    db.exec("ALTER TABLE online_orders DROP COLUMN order_data");
    console.log('Migrated order_data to online_orders_data and removed column');
  }
} catch (err) {
  console.log('Online orders data migration note:', err.message);
}

// Create tables
db.exec(`
  -- Restaurants table
  CREATE TABLE IF NOT EXISTS restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    gst_number TEXT,
    fssai_number TEXT,
    logo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'waiter', 'accountant')),
    restaurant_id TEXT,
    must_reset_password INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    pin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Categories table
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Sections table
  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Tables table
  CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    section_id TEXT,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available',
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Products table
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT,
    description TEXT,
    selling_price REAL NOT NULL,
    mrp REAL DEFAULT 0 CHECK(mrp = ROUND(mrp, 2)),
    tax_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    enable_online INTEGER DEFAULT 0,
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Orders table
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    table_id TEXT,
    user_id TEXT,
    waiter_id TEXT,
    customer_id TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'kot', 'billed')),
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    loyalty_discount REAL DEFAULT 0,
    discount_reason TEXT,
    total REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (waiter_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  -- Order items table
  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL NOT NULL,
    is_kot INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  -- Settings table
  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT UNIQUE,
    cgst_rate REAL DEFAULT 9,
    sgst_rate REAL DEFAULT 9,
    default_tax_rate REAL DEFAULT 18,
    price_inclusive_tax INTEGER DEFAULT 0,
    kot_printer TEXT,
    bill_printer TEXT,
    print_copies INTEGER DEFAULT 1,
    skip_lines_before_cut INTEGER DEFAULT 3,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Printer settings table
  CREATE TABLE IF NOT EXISTS printer_settings (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    printer_name TEXT NOT NULL,
    printer_type TEXT CHECK(printer_type IN ('kot', 'bill', 'label')) NOT NULL,
    printer_ip TEXT,
    printer_port INTEGER DEFAULT 9100,
    is_default INTEGER DEFAULT 0,
    paper_width INTEGER DEFAULT 80,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Tax setup table
  CREATE TABLE IF NOT EXISTS tax_setup (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    tax_name TEXT NOT NULL,
    tax_rate REAL NOT NULL,
    tax_type TEXT CHECK(tax_type IN ('cgst', 'sgst', 'combined', 'igst')) DEFAULT 'combined',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Bill setup table
  CREATE TABLE IF NOT EXISTS bill_setup (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    header_text TEXT,
    footer_text TEXT,
    show_logo INTEGER DEFAULT 1,
    show_qr INTEGER DEFAULT 0,
    qr_data TEXT,
    show_tax_breakup INTEGER DEFAULT 1,
    show_waiter INTEGER DEFAULT 0,
    show_table INTEGER DEFAULT 1,
    show_order_no INTEGER DEFAULT 1,
    paper_size TEXT DEFAULT '80mm',
    font_size INTEGER DEFAULT 12,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- KOT setup table
  CREATE TABLE IF NOT EXISTS kot_setup (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    header_text TEXT,
    footer_text TEXT,
    show_logo INTEGER DEFAULT 1,
    show_category INTEGER DEFAULT 1,
    show_item_notes INTEGER DEFAULT 1,
    show_modifiers INTEGER DEFAULT 1,
    paper_size TEXT DEFAULT '80mm',
    font_size INTEGER DEFAULT 12,
    auto_print INTEGER DEFAULT 1,
    print_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- User rights table
  CREATE TABLE IF NOT EXISTS user_rights (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    role TEXT NOT NULL,
    can_take_orders INTEGER DEFAULT 1,
    can_print_kot INTEGER DEFAULT 1,
    can_print_bill INTEGER DEFAULT 1,
    can_void_order INTEGER DEFAULT 0,
    can_apply_discount INTEGER DEFAULT 0,
    can_give_complimentary INTEGER DEFAULT 0,
    can_view_reports INTEGER DEFAULT 0,
    can_manage_products INTEGER DEFAULT 0,
    can_manage_users INTEGER DEFAULT 0,
    can_manage_settings INTEGER DEFAULT 0,
    can_refund INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Table status colors table
  CREATE TABLE IF NOT EXISTS table_status_colors (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT,
    status_key TEXT NOT NULL,
    bg TEXT NOT NULL,
    border TEXT NOT NULL,
    label TEXT NOT NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    UNIQUE(restaurant_id, status_key)
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_restaurant ON products(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section_id);
  CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
  CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
  CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_sections_restaurant ON sections(restaurant_id);
  
  -- Customers table
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    place TEXT,
    food_preference TEXT CHECK(food_preference IN ('veg', 'non-veg', 'both')) DEFAULT 'both',
    loyalty_discount REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  
  -- Online Orders table
  CREATE TABLE IF NOT EXISTS online_orders (
    id TEXT PRIMARY KEY,
    external_order_id TEXT,
    platform TEXT NOT NULL CHECK(platform IN ('swiggy', 'zomato', 'magicpin', 'other')),
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled', 'declined')),
    total_amount REAL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    estimated_time INTEGER,
    restaurant_id TEXT,
    linked_order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (linked_order_id) REFERENCES orders(id)
  );
  
  -- Online Orders Data table (stores key-value pairs for order metadata)
  -- This replaces the order_data JSON column from online_orders
  CREATE TABLE IF NOT EXISTS online_orders_data (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    data_key TEXT NOT NULL,
    data_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES online_orders(id) ON DELETE CASCADE,
    UNIQUE(order_id, data_key)
  );
  
  CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
  CREATE INDEX IF NOT EXISTS idx_online_orders_platform ON online_orders(platform);
  CREATE INDEX IF NOT EXISTS idx_online_orders_created ON online_orders(created_at);
  
  -- Table Waiter Allocations (maps tables to assigned waiters)
  CREATE TABLE IF NOT EXISTS table_waiter_allocations (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    waiter_id TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (waiter_id) REFERENCES users(id),
    UNIQUE(table_id, waiter_id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_twa_table ON table_waiter_allocations(table_id);
  CREATE INDEX IF NOT EXISTS idx_twa_waiter ON table_waiter_allocations(waiter_id);
  CREATE INDEX IF NOT EXISTS idx_twa_active ON table_waiter_allocations(is_active);
  
  -- Customer Orders (direct orders via NFC/QR)
  CREATE TABLE IF NOT EXISTS customer_orders (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    table_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    order_source TEXT DEFAULT 'nfc' CHECK(order_source IN ('nfc', 'qr', 'direct')),
    accepted_by TEXT,
    accepted_at DATETIME,
    declined_reason TEXT,
    notes TEXT,
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (accepted_by) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_co_table ON customer_orders(table_id);
  CREATE INDEX IF NOT EXISTS idx_co_status ON customer_orders(status);
  CREATE INDEX IF NOT EXISTS idx_co_created ON customer_orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_co_waiter ON customer_orders(accepted_by);
  
  -- Customer Order Items
  CREATE TABLE IF NOT EXISTS customer_order_items (
    id TEXT PRIMARY KEY,
    customer_order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_order_id) REFERENCES customer_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_coi_order ON customer_order_items(customer_order_id);
  CREATE INDEX IF NOT EXISTS idx_coi_product ON customer_order_items(product_id);
  
  -- Waiter Notifications
  CREATE TABLE IF NOT EXISTS waiter_notifications (
    id TEXT PRIMARY KEY,
    waiter_id TEXT NOT NULL,
    table_id TEXT,
    table_number TEXT,
    customer_order_id TEXT,
    notification_type TEXT DEFAULT 'order' CHECK(notification_type IN ('order', 'accept', 'decline', 'system')),
    title TEXT NOT NULL,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    is_acknowledged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (waiter_id) REFERENCES users(id),
    FOREIGN KEY (table_id) REFERENCES tables(id),
    FOREIGN KEY (customer_order_id) REFERENCES customer_orders(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_wn_waiter ON waiter_notifications(waiter_id);
  CREATE INDEX IF NOT EXISTS idx_wn_read ON waiter_notifications(is_read);
  CREATE INDEX IF NOT EXISTS idx_wn_created ON waiter_notifications(created_at);
  
  -- Customer OTP for login verification
  CREATE TABLE IF NOT EXISTS customer_otp (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    otp TEXT NOT NULL,
    is_verified INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email)
  );
  
  CREATE INDEX IF NOT EXISTS idx_cotp_email ON customer_otp(email);
  CREATE INDEX IF NOT EXISTS idx_cotp_expires ON customer_otp(expires_at);
  
  -- Customer Accounts (for online ordering)
  CREATE TABLE IF NOT EXISTS customer_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    default_order_type TEXT DEFAULT 'pickup' CHECK(default_order_type IN ('pickup', 'delivery')),
    is_active INTEGER DEFAULT 1,
    restaurant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_ca_email ON customer_accounts(email);
  CREATE INDEX IF NOT EXISTS idx_ca_phone ON customer_accounts(phone);
  CREATE INDEX IF NOT EXISTS idx_ca_restaurant ON customer_accounts(restaurant_id);
  
  -- Online Ordering Settings
  CREATE TABLE IF NOT EXISTS online_ordering_settings (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT UNIQUE NOT NULL,
    is_enabled INTEGER DEFAULT 1,
    free_delivery_radius_km REAL DEFAULT 5,
    paid_delivery_radius_km REAL DEFAULT 10,
    delivery_charge REAL DEFAULT 0,
    min_order_amount REAL DEFAULT 0,
    allow_pickup INTEGER DEFAULT 1,
    allow_delivery INTEGER DEFAULT 1,
    estimated_prep_time_minutes INTEGER DEFAULT 20,
    delivery_instructions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_oos_restaurant ON online_ordering_settings(restaurant_id);

  -- Online Ordering Payment Settings (separate table)
  CREATE TABLE IF NOT EXISTS payment_settings (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT UNIQUE NOT NULL,
    -- Pickup settings
    pickup_min_order_amount REAL DEFAULT 0,
    pickup_accept_cash INTEGER DEFAULT 1,
    pickup_accept_upi INTEGER DEFAULT 1,
    pickup_accept_card INTEGER DEFAULT 1,
    pickup_accept_paypal INTEGER DEFAULT 0,
    -- Delivery settings
    delivery_min_order_amount REAL DEFAULT 0,
    delivery_accept_cash INTEGER DEFAULT 1,
    delivery_accept_upi INTEGER DEFAULT 1,
    delivery_accept_card INTEGER DEFAULT 1,
    delivery_accept_paypal INTEGER DEFAULT 0,
    -- UPI Settings
    upi_id TEXT,
    upi_merchant_name TEXT,
    -- PhonePe Gateway
    phonepe_merchant_id TEXT,
    phonepe_merchant_key TEXT,
    phonepe_environment TEXT DEFAULT 'sandbox' CHECK(phonepe_environment IN ('sandbox', 'production')),
    phonepe_is_enabled INTEGER DEFAULT 0,
    -- Stripe Gateway
    stripe_api_key TEXT,
    stripe_webhook_secret TEXT,
    stripe_environment TEXT DEFAULT 'test' CHECK(stripe_environment IN ('test', 'live')),
    stripe_is_enabled INTEGER DEFAULT 0,
    -- PayPal Gateway
    paypal_client_id TEXT,
    paypal_client_secret TEXT,
    paypal_environment TEXT DEFAULT 'sandbox' CHECK(paypal_environment IN ('sandbox', 'production')),
    paypal_is_enabled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  CREATE INDEX IF NOT EXISTS idx_ps_restaurant ON payment_settings(restaurant_id);
  
  -- Customer Online Orders (placed via catalog)
  CREATE TABLE IF NOT EXISTS customer_online_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_account_id TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT,
    order_type TEXT NOT NULL CHECK(order_type IN ('pickup', 'delivery')),
    delivery_distance_km REAL,
    delivery_charge REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    payment_method TEXT CHECK(payment_method IN ('online', 'cod', 'pay_at_restaurant')),
    payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled')),
    estimated_ready_time DATETIME,
    special_instructions TEXT,
    notes TEXT,
    restaurant_id TEXT NOT NULL,
    linked_order_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (linked_order_id) REFERENCES orders(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_coo_status ON customer_online_orders(status);
  CREATE INDEX IF NOT EXISTS idx_coo_customer ON customer_online_orders(customer_account_id);
  CREATE INDEX IF NOT EXISTS idx_coo_restaurant ON customer_online_orders(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_coo_created ON customer_online_orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_coo_order_number ON customer_online_orders(order_number);
  
  -- Customer Online Order Items
  CREATE TABLE IF NOT EXISTS customer_online_order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES customer_online_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
  
  CREATE INDEX IF NOT EXISTS idx_cooi_order ON customer_online_order_items(order_id);
`);

// Create table_status_colors table (separate from settings table)
try {
  const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='table_status_colors'").get();
  if (!existingTables) {
    db.exec(`
      CREATE TABLE table_status_colors (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        status_key TEXT NOT NULL,
        bg TEXT NOT NULL DEFAULT '#22c55e',
        border TEXT NOT NULL DEFAULT '#16a34a',
        label TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(restaurant_id, status_key)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_tsc_restaurant ON table_status_colors(restaurant_id)');
    console.log('Created table_status_colors table');
  }
} catch (err) {
  console.log('Table status colors creation note:', err.message);
}

// Set default table status colors for all existing restaurants
try {
  const restaurants = db.prepare('SELECT id FROM restaurants').all();
  for (const restaurant of restaurants) {
    const existingColors = db.prepare('SELECT COUNT(*) as count FROM table_status_colors WHERE restaurant_id = ?').get(restaurant.id);
    if (existingColors.count === 0) {
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
        `).run(randomUUID(), restaurant.id, status.key, status.bg, status.border, status.label);
      }
    }
  }
} catch (err) {
  console.log('Default table status colors setup note:', err.message);
}

export default db;