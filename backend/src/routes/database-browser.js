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
    .btn-secondary { background: #6c757d; color: #fff; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
    .btn-secondary:hover { background: #5a6268; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 10px; text-align: left; border: 1px solid #333; }
    th { background: #0f3460; color: #00d4ff; }
    tr:nth-child(even) { background: #1a1a2e; }
    tr:hover { background: #2a2a4e; }
    .error { color: #ff6b6b; margin-top: 10px; }
    .success { color: #51cf66; margin-top: 10px; }
    .row-count { color: #888; font-size: 0.9rem; margin-top: 10px; }
    .loading { color: #888; text-align: center; padding: 20px; }
    
    /* Columns Panel */
    .columns-panel { display: none; background: #0f3460; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
    .columns-panel.visible { display: block; }
    .columns-panel h3 { color: #00d4ff; margin-bottom: 10px; font-size: 1rem; }
    .columns-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .column-tag { background: #16213e; padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; color: #ccc; border: 1px solid #333; }
    .column-tag.type-int { border-color: #4dabf7; }
    .column-tag.type-text { border-color: #69db7c; }
    .column-tag.type-real { border-color: #ffd43b; }
    .column-tag.pk { background: #e64980; color: #fff; }
    
    /* Modal */
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 1000; justify-content: center; align-items: center; }
    .modal.visible { display: flex; }
    .modal-content { background: #16213e; border-radius: 10px; padding: 25px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .modal-header h3 { color: #00d4ff; }
    .close-btn { background: none; border: none; color: #fff; font-size: 24px; cursor: pointer; }
    .close-btn:hover { color: #00d4ff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🗄️ SQLite Browser - Oyebill</h1>
    
    <div class="section">
      <h2>📋 Tables <span id="tableCount" style="color:#888;font-weight:normal;font-size:0.9rem"></span></h2>
      <div class="tables-grid" id="tablesGrid">
        <div class="loading">Loading tables...</div>
      </div>
      
      <!-- Columns Panel -->
      <div class="columns-panel" id="columnsPanel">
        <h3>📑 Columns in <span id="selectedTableName"></span></h3>
        <div class="columns-list" id="columnsList"></div>
      </div>
      
      <h2>💻 SQL Query <span id="currentTable" style="color:#888;font-weight:normal;font-size:0.8rem"></span></h2>
      <textarea id="sql" placeholder="SELECT * FROM tables LIMIT 10"></textarea>
      <div style="margin-top: 10px; display: flex; gap: 10px;">
        <button class="btn" onclick="executeQuery()">▶ Execute</button>
        <button class="btn-secondary" onclick="clearQuery()">Clear</button>
      </div>
      <div id="message"></div>
    </div>
    
    <div class="section">
      <h2>📊 Results <span id="rowCount" style="color:#888;font-weight:normal;font-size:0.8rem"></span></h2>
      <div id="results"></div>
    </div>
  </div>
  
  <!-- Columns Modal -->
  <div class="modal" id="columnsModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>📑 <span id="modalTableName"></span> - Columns</h3>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <div id="modalColumns"></div>
    </div>
  </div>
  
  <script>
    let currentTable = '';
    
    async function loadTables() {
      try {
        const res = await fetch('/api/database/tables');
        const data = await res.json();
        const grid = document.getElementById('tablesGrid');
        document.getElementById('tableCount').textContent = '(' + data.tables.length + ' tables)';
        
        grid.innerHTML = data.tables.map(t => 
          '<button class="table-btn" onclick="selectTable(\\'' + t + '\\')">' + t + '</button>'
        ).join('');
      } catch (e) {
        document.getElementById('tablesGrid').innerHTML = '<div class="error">Failed to load tables</div>';
      }
    }
    
    async function selectTable(tableName) {
      currentTable = tableName;
      
      // Update button states
      document.querySelectorAll('.table-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === tableName) btn.classList.add('active');
      });
      
      // Show columns panel
      const panel = document.getElementById('columnsPanel');
      const tableNameSpan = document.getElementById('selectedTableName');
      const columnsList = document.getElementById('columnsList');
      
      panel.classList.add('visible');
      tableNameSpan.textContent = tableName;
      columnsList.innerHTML = '<div class="loading">Loading...</div>';
      
      // Fetch columns
      try {
        const res = await fetch('/api/database/columns/' + tableName);
        const data = await res.json();
        
        if (data.success && data.columns.length > 0) {
          columnsList.innerHTML = data.columns.map(col => {
            let typeClass = 'type-text';
            if (col.type.includes('INT') || col.type.includes('INTEGER')) typeClass = 'type-int';
            else if (col.type.includes('REAL') || col.type.includes('FLOAT') || col.type.includes('DOUBLE')) typeClass = 'type-real';
            
            const pkClass = col.pk ? ' pk' : '';
            const pkBadge = col.pk ? ' 🔑' : '';
            
            return '<span class="column-tag ' + typeClass + pkClass + '">' + col.name + pkBadge + '<small style="color:#888;margin-left:4px">' + col.type + '</small></span>';
          }).join('');
        } else {
          columnsList.innerHTML = '<div style="color:#888">No columns found</div>';
        }
      } catch (e) {
        columnsList.innerHTML = '<div class="error">Failed to load columns</div>';
      }
      
      // Update SQL textarea
      document.getElementById('sql').value = 'SELECT * FROM ' + tableName + ' LIMIT 100';
      document.getElementById('currentTable').textContent = '| Currently viewing: ' + tableName;
      executeQuery();
    }
    
    function showModal(tableName) {
      document.getElementById('modalTableName').textContent = tableName;
      document.getElementById('columnsModal').classList.add('visible');
      
      const modalColumns = document.getElementById('modalColumns');
      modalColumns.innerHTML = '<div class="loading">Loading...</div>';
      
      fetch('/api/database/columns/' + tableName)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.columns.length > 0) {
            modalColumns.innerHTML = '<table>' +
              '<thead><tr><th>Column</th><th>Type</th><th>Null</th><th>Default</th><th>PK</th></tr></thead>' +
              '<tbody>' +
              data.columns.map(col => 
                '<tr><td>' + col.name + '</td><td>' + col.type + '</td><td>' + (col.notnull ? '❌' : '✅') + '</td><td>' + (col.dflt_value || '-') + '</td><td>' + (col.pk ? '🔑' : '-') + '</td></tr>'
              ).join('') +
              '</tbody></table>';
          } else {
            modalColumns.innerHTML = '<div style="color:#888">No columns found</div>';
          }
        })
        .catch(e => { modalColumns.innerHTML = '<div class="error">Failed to load</div>'; });
    }
    
    function closeModal() {
      document.getElementById('columnsModal').classList.remove('visible');
    }
    
    async function executeQuery() {
      const sql = document.getElementById('sql').value.trim();
      const msg = document.getElementById('message');
      const results = document.getElementById('results');
      document.getElementById('rowCount').textContent = '';
      
      if (!sql) { msg.innerHTML = '<div class="error">Enter query</div>'; return; }
      try {
        const res = await fetch('/api/database/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql })
        });
        const data = await res.json();
        if (data.error) { 
          msg.innerHTML = '<div class="error">❌ ' + data.error + '</div>'; 
          results.innerHTML = ''; 
          document.getElementById('rowCount').textContent = '';
        }
        else {
          msg.innerHTML = '<div class="success">✅ Query executed</div>';
          document.getElementById('rowCount').textContent = '(' + (data.rows?.length || 0) + ' rows)';
          if (data.rows?.length) {
            let html = '<table><thead><tr>';
            data.columns.forEach(c => html += '<th>' + c + '</th>');
            html += '</tr></thead><tbody>';
            data.rows.forEach(r => {
              html += '<tr>';
              data.columns.forEach(c => {
                const val = r[c];
                html += '<td>' + (val === null ? '<em style=color:#666>NULL</em>' : (typeof val === 'object' ? JSON.stringify(val) : val)) + '</td>';
              });
              html += '</tr>';
            });
            html += '</tbody></table>';
            results.innerHTML = html;
          } else results.innerHTML = '<div class="row-count">Query executed successfully (0 rows returned)</div>';
        }
      } catch (e) { msg.innerHTML = '<div class="error">❌ ' + e.message + '</div>'; }
    }
    
    function clearQuery() {
      document.getElementById('sql').value = '';
      document.getElementById('results').innerHTML = '';
      document.getElementById('message').innerHTML = '';
      document.getElementById('rowCount').textContent = '';
      document.getElementById('currentTable').textContent = '';
      document.getElementById('columnsPanel').classList.remove('visible');
      document.querySelectorAll('.table-btn').forEach(btn => btn.classList.remove('active'));
      currentTable = '';
    }
    
    // Close modal on background click
    document.getElementById('columnsModal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    
    // Load tables on page load
    loadTables();
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

// Get columns for a specific table
router.get('/columns/:tableName', authenticateToken, requireRole('admin'), (req, res) => {
  const { db } = req;
  const { tableName } = req.params;
  
  // Validate table name to prevent SQL injection
  const validName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
  if (!validName) {
    return res.status(400).json({ error: 'Invalid table name' });
  }
  
  try {
    const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    res.json({ success: true, columns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;