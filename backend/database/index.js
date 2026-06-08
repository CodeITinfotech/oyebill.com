import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'oyebill.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'reserved')),
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
    mrp REAL DEFAULT 0,
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
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section_id);
  CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  
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
    order_data TEXT,
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
  
  CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
  CREATE INDEX IF NOT EXISTS idx_online_orders_platform ON online_orders(platform);
  CREATE INDEX IF NOT EXISTS idx_online_orders_created ON online_orders(created_at);
`);

export default db;