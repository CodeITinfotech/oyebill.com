import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Serve the SQLite browser UI
router.get('/', authenticateToken, requireRole('admin'), (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>SQLite Browser - Oyebill</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { color: #00d4ff; margin-bottom: 20px; }
    .section { background: #16213e; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    h2 { color: #00d4ff; margin-bottom: 15px; font-size: 1.2rem; }
    .tables-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .table-btn { background: #0f3460; color: #fff; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; transition: background 0.2s; }
    .table-btn:hover { background: #00d4ff; color: #000; }
    .table-btn.active { background: #00d4ff; color: #000; }
    textarea { width: 100%; height: 100px; background: #0f3460; color: #fff; border: 1px solid #333; border-radius: 5px; padding: 10px; font-family: 'Monaco', 'Menlo', monospace; font-size: 14px; resize: vertical; }
    .btn { background: #00d4ff; color: #000; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
    .btn:hover { background: #00b8d4; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 10px; text-align: left; border: 1px solid #333; }
    th { background: #0f3460; color: #00d4ff; }
    tr:nth-child(even) { background: #1a1a2e; }
    tr:hover { background: #2a2a4e; }
    .error { color: #ff6b6b; margin-top: 10px; }
    .success { color: #51cf66; margin-top: 10px; }
    .row-count { color: #888; font-size: 0.9rem; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🗄️ SQLite Browser - Oyebill</h1>
    <div class="section">
      <h2>📋 Tables</h2>
      <div class="tables-grid">
        <button class="table-btn" onclick="loadTable('tables')">tables</button>
        <button class="table-btn" onclick="loadTable('orders')">orders</button>
        <button class="table-btn" onclick="loadTable('order_items')">order_items</button>
        <button class="table-btn" onclick="loadTable('products')">products</button>
        <button class="table-btn" onclick="loadTable('categories')">categories</button>
        <button class="table-btn" onclick="loadTable('sections')">sections</button>
        <button class="table-btn" onclick="loadTable('users')">users</button>
        <button class="table-btn" onclick="loadTable('restaurants')">restaurants</button>
        <button class="table-btn" onclick="loadTable('customers')">customers</button>
        <button class="table-btn" onclick="loadTable('settings')">settings</button>
      </div>
      <h2>💻 SQL Query</h2>
      <textarea id="sql" placeholder="SELECT * FROM tables LIMIT 10"></textarea>
      <div style="margin-top: 10px;">
        <button class="btn" onclick="executeQuery()">▶ Execute</button>
      </div>
      <div id="message"></div>
    </div>
    <div class="section">
      <h2>📊 Results</h2>
      <div id="results"></div>
    </div>
  </div>
  <script>
    function loadTable(t) {
      document.getElementById('sql').value = 'SELECT * FROM ' + t + ' LIMIT 100';
      executeQuery();
    }
    async function executeQuery() {
      const sql = document.getElementById('sql').value.trim();
      const msg = document.getElementById('message');
      const results = document.getElementById('results');
      if (!sql) { msg.innerHTML = '<div class="error">Enter query</div>'; return; }
      try {
        const res = await fetch('/api/database/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });
        const data = await res.json();
        if (data.error) { msg.innerHTML = '<div class="error">❌ ' + data.error + '</div>'; results.innerHTML = ''; }
        else {
          msg.innerHTML = '<div class="success">✅ ' + (data.rows?.length || 0) + ' rows</div>';
          if (data.rows?.length) {
            let html = '<table><thead><tr>';
            data.columns.forEach(c => html += '<th>' + c + '</th>');
            html += '</tr></thead><tbody>';
            data.rows.forEach(r => {
              html += '<tr>';
              data.columns.forEach(c => html += '<td>' + (r[c] ?? '<em style=color:#666>NULL</em>') + '</td>');
              html += '</tr>';
            });
            html += '</tbody></table>';
            results.innerHTML = html;
          } else results.innerHTML = '<div class="row-count">No rows</div>';
        }
      } catch (e) { msg.innerHTML = '<div class="error">❌ ' + e.message + '</div>'; }
    }
  </script>
</body>
</html>
  `);
});

// Execute SQL query - requires authentication
router.post('/query', authenticateToken, requireRole('admin'), (req, res) => {
  const { sql } = req.body;
  const { db } = req;
  
  if (!sql) return res.status(400).json({ error: 'SQL required' });
  
  const trimmed = sql.trim().toLowerCase();
  if (!trimmed.startsWith('select')) {
    return res.status(400).json({ error: 'Only SELECT queries allowed' });
  }
  
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all();
    res.json({ columns: rows.length ? Object.keys(rows[0]) : [], rows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get list of tables
router.get('/tables', authenticateToken, requireRole('admin'), (req, res) => {
  const { db } = req;
  
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    res.json({ success: true, tables: tables.map(t => t.name) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;