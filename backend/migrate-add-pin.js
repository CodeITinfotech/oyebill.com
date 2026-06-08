import db from './database/index.js';

// Add PIN columns
try {
  db.exec("ALTER TABLE users ADD COLUMN pin TEXT DEFAULT NULL");
  console.log('Added pin column');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('pin column already exists');
  } else {
    console.error('Error adding pin column:', e.message);
  }
}

try {
  db.exec("ALTER TABLE users ADD COLUMN pin_failed_attempts INTEGER DEFAULT 0");
  console.log('Added pin_failed_attempts column');
} catch (e) {
  if (e.message.includes('duplicate column')) {
    console.log('pin_failed_attempts column already exists');
  } else {
    console.error('Error adding pin_failed_attempts column:', e.message);
  }
}

// Set PIN for existing waiters/bussers (4-digit random PIN)
const waiters = db.prepare("SELECT id, name FROM users WHERE role IN ('waiter', 'busser') AND pin IS NULL").all();
waiters.forEach(waiter => {
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  db.prepare("UPDATE users SET pin = ? WHERE id = ?").run(pin, waiter.id);
  console.log(`Set PIN ${pin} for ${waiter.name}`);
});

console.log(`\nTotal waiters/bussers with PIN: ${waiters.length}`);