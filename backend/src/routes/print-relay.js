import express from 'express';

const router = express.Router();

// Initialize print_jobs table if not exists
function initPrintJobsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id TEXT NOT NULL,
      job_type TEXT NOT NULL,
      content TEXT NOT NULL,
      copies INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);
}

// Queue a print job (called by the app)
router.post('/queue', (req, res) => {
  try {
    const { restaurantId, jobType, content, copies = 1 } = req.body;
    const db = req.db;
    
    initPrintJobsTable(db);
    
    const stmt = db.prepare(`
      INSERT INTO print_jobs (restaurant_id, job_type, content, copies, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);
    
    const result = stmt.run(restaurantId, jobType, content, copies);
    
    res.json({ success: true, jobId: result.lastInsertRowid });
  } catch (error) {
    console.error('Queue print job error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Poll for pending print jobs (called by local relay)
router.get('/poll', (req, res) => {
  try {
    const { restaurantId } = req.query;
    const db = req.db;
    
    initPrintJobsTable(db);
    
    // Get pending jobs for this restaurant
    const jobs = db.prepare(`
      SELECT * FROM print_jobs 
      WHERE restaurant_id = ? AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `).all(restaurantId);
    
    res.json({ success: true, jobs });
  } catch (error) {
    console.error('Poll print jobs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark job as completed
router.post('/complete', (req, res) => {
  try {
    const { jobId } = req.body;
    const db = req.db;
    
    const stmt = db.prepare(`
      UPDATE print_jobs 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(jobId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Complete print job error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark job as failed
router.post('/fail', (req, res) => {
  try {
    const { jobId, error } = req.body;
    const db = req.db;
    
    const stmt = db.prepare(`
      UPDATE print_jobs 
      SET status = 'failed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(jobId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Fail print job error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clean up old completed jobs (keep last 24 hours)
router.post('/cleanup', (req, res) => {
  try {
    const db = req.db;
    
    db.prepare(`
      DELETE FROM print_jobs 
      WHERE status IN ('completed', 'failed') 
      AND created_at < datetime('now', '-24 hours')
    `).run();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Cleanup print jobs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;