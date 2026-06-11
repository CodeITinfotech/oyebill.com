import { useEffect, useState } from 'react';
import { api } from '../../api';

export default function DatabaseBrowser() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [query, setQuery] = useState('SELECT * FROM tables LIMIT 10');
  const [results, setResults] = useState<{columns: string[], rows: any[]}>({ columns: [], rows: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const allTables = [
    'tables', 'orders', 'order_items', 'products', 'categories', 'sections',
    'users', 'restaurants', 'customers', 'settings', 'printer_settings',
    'tax_setup', 'bill_setup', 'kot_setup', 'user_rights', 'table_status_colors',
    'online_orders', 'online_ordering_settings', 'table_waiter_allocations',
    'customer_orders', 'customer_order_items', 'customer_online_orders',
    'customer_online_order_items', 'customer_accounts', 'customer_otp',
    'waiter_notifications'
  ];

  useEffect(() => {
    // Fetch tables list from API
    const fetchTables = async () => {
      try {
        const res = await api.get('/database/tables');
        if (res.success && res.tables) {
          setTables(res.tables);
        } else {
          setTables(allTables);
        }
      } catch (e) {
        setTables(allTables);
      }
    };
    fetchTables();
  }, []);

  const loadTable = (table: string) => {
    setSelectedTable(table);
    setQuery(`SELECT * FROM ${table} LIMIT 100`);
    executeQuery(`SELECT * FROM ${table} LIMIT 100`);
  };

  const executeQuery = async (sql = query) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/database/query', { sql });
      if (res.success && res.data) {
        setResults({ columns: res.data.columns || [], rows: res.data.rows || [] });
      } else {
        setError(res.error || 'Query failed');
        setResults({ columns: [], rows: [] });
      }
    } catch (e: any) {
      setError(e.message || 'Query failed');
      setResults({ columns: [], rows: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const res = await api.get('/database/tables');
      if (res.success && res.tables) {
        setTables(res.tables);
      }
    } catch (e) {
      console.error('Failed to refresh tables');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#00d4ff', margin: 0 }}>🗄️ SQLite Browser</h1>
        <button onClick={handleRefresh} style={{ ...btnStyle, background: '#1a1a2e' }}>
          🔄 Refresh Tables
        </button>
      </div>
      
      <div style={{ background: '#16213e', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ color: '#00d4ff', marginBottom: '15px' }}>📋 Tables</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {tables.map(t => (
            <button
              key={t}
              onClick={() => loadTable(t)}
              style={{
                ...btnStyle,
                background: selectedTable === t ? '#00d4ff' : '#0f3460',
                color: selectedTable === t ? '#16213e' : '#fff',
                fontWeight: selectedTable === t ? 'bold' : 'normal'
              }}
            >
              {t}
            </button>
          ))}
        </div>
        
        <h2 style={{ color: '#00d4ff', marginBottom: '15px' }}>💻 SQL Query</h2>
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', height: '80px', background: '#0f3460', color: '#fff', border: '1px solid #333', borderRadius: '5px', padding: '10px', fontFamily: 'monospace' }}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={() => executeQuery()} style={{ ...btnStyle, background: '#00d4ff', color: '#16213e' }}>
            ▶ Execute
          </button>
          <button onClick={() => { setQuery(''); setResults({ columns: [], rows: [] }); }} style={{ ...btnStyle, background: '#ff6b6b' }}>
            Clear
          </button>
        </div>
        
        {error && <div style={{ color: '#ff6b6b', marginTop: '10px' }}>❌ {error}</div>}
      </div>
      
      <div style={{ background: '#16213e', borderRadius: '8px', padding: '20px' }}>
        <h2 style={{ color: '#00d4ff', marginBottom: '15px' }}>
          📊 Results 
          {loading && <span style={{ color: '#888', fontWeight: 'normal' }}> (Loading...)</span>}
          {!loading && results.rows.length > 0 && <span style={{ color: '#888', fontWeight: 'normal' }}> - {results.rows.length} rows</span>}
        </h2>
        {results.rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {results.columns.map(c => <th key={c} style={{ padding: '10px', border: '1px solid #333', background: '#0f3460', color: '#00d4ff', textAlign: 'left' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    {results.columns.map(c => <td key={c} style={{ padding: '10px', color: row[c] === null ? '#666' : '#eee' }}>{row[c] === null ? 'NULL' : String(row[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ color: '#888' }}>No results - Execute a query to see data</div>}
      </div>
    </div>
  );
}

const btnStyle = { background: '#0f3460', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' };