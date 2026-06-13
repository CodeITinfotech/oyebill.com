import express from 'express';

const router = express.Router();

// Get dashboard analytics
router.get('/analytics', (req, res) => {
  try {
    const { db } = req;
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'] || '23fcaf4f-31a8-4e2b-888c-bae861e8c718';
    const { period = 'all' } = req.query;

    let dateCondition = "date(o.created_at) = date('now')";
    if (period === 'week') {
      dateCondition = "o.created_at >= datetime('now', '-7 days')";
    } else if (period === 'month') {
      dateCondition = "o.created_at >= datetime('now', '-30 days')";
    } else if (period === 'all') {
      dateCondition = '1=1';
    }

    // 1. Total Orders (completed billing - paid status)
    const totalOrdersResult = db.prepare(`
      SELECT COUNT(*) as count FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND o.status = 'billed' AND ${dateCondition}
    `).get(restaurantId);

    // 2. Total Revenue
    const revenueResult = db.prepare(`
      SELECT COALESCE(SUM(o.total), 0) as revenue FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND o.status = 'billed' AND ${dateCondition}
    `).get(restaurantId);

    // 3. Order status breakdown
    const orderStats = db.prepare(`
      SELECT o.status, COUNT(*) as count, COALESCE(SUM(o.total), 0) as revenue
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND ${dateCondition}
      GROUP BY o.status
    `).all(restaurantId);

    // 4. Revenue by Month (last 12 months)
    const monthlyRevenue = db.prepare(`
      SELECT 
        strftime('%Y-%m', o.created_at) as month,
        COALESCE(SUM(o.total), 0) as revenue,
        COUNT(*) as orders
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND o.status = 'billed'
        AND o.created_at >= datetime('now', '-12 months')
      GROUP BY strftime('%Y-%m', o.created_at)
      ORDER BY month ASC
    `).all(restaurantId);

    // 5. Top Selling Products
    const topProducts = db.prepare(`
      SELECT 
        oi.product_name as name,
        SUM(oi.quantity) as quantity,
        SUM(oi.total) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND o.status = 'billed' AND ${dateCondition}
      GROUP BY oi.product_name
      ORDER BY quantity DESC
      LIMIT 10
    `).all(restaurantId);

    // 6. Product Sales (category breakdown)
    const productSales = db.prepare(`
      SELECT 
        c.name as category,
        COALESCE(SUM(oi.quantity), 0) as quantity,
        COALESCE(SUM(oi.total), 0) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN tables t ON o.table_id = t.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE t.restaurant_id = ? AND o.status = 'billed' AND ${dateCondition}
      GROUP BY c.name
      ORDER BY revenue DESC
    `).all(restaurantId);

    // 7. Table Occupancy
    const tableStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('active_kot', 'occupied', 'active') THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'pending_cleaning' THEN 1 ELSE 0 END) as pending_cleaning
      FROM tables 
      WHERE restaurant_id = ?
    `).get(restaurantId);

    // 8. Waiter Rankings
    const waiterRankings = db.prepare(`
      SELECT 
        u.name,
        u.role,
        COUNT(o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_revenue
      FROM users u
      LEFT JOIN orders o ON u.id = o.waiter_id AND o.status = 'billed' AND ${dateCondition}
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND u.role IN ('waiter', 'admin')
      GROUP BY u.id
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all(restaurantId);

    // 9. Busser Rankings (based on user role, simplified)
    const busserRankings = db.prepare(`
      SELECT name, 0 as tables_cleaned
      FROM users 
      WHERE restaurant_id = ? AND role = 'busser'
      ORDER BY name
      LIMIT 10
    `).all(restaurantId);

    // 10. Recent Orders
    const recentOrders = db.prepare(`
      SELECT 
        o.id,
        o.id as orderNumber,
        o.total,
        o.status,
        o.created_at,
        t.number as tableNumber
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ? AND o.status = 'billed'
      ORDER BY o.created_at DESC
      LIMIT 20
    `).all(restaurantId);

    res.json({
      success: true,
      data: {
        summary: {
          totalOrders: totalOrdersResult.count,
          totalRevenue: revenueResult.revenue,
        },
        orderStats,
        monthlyRevenue,
        topProducts,
        productSales,
        tableStats,
        waiterRankings,
        busserRankings,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
  }
});

// Get specific metric
router.get('/metric/:type', (req, res) => {
  try {
    const { db } = req;
    const restaurantId = req.user?.restaurantId || req.headers['x-restaurant-id'] || '23fcaf4f-31a8-4e2b-888c-bae861e8c718';
    const { type } = req.params;

    let result;
    switch (type) {
      case 'orders-today':
        result = db.prepare(`
          SELECT COUNT(*) as count FROM orders o
          JOIN tables t ON o.table_id = t.id
          WHERE t.restaurant_id = ? AND o.status = 'billed' AND date(o.created_at) = date('now')
        `).get(restaurantId);
        break;
      case 'revenue-today':
        result = db.prepare(`
          SELECT COALESCE(SUM(o.total), 0) as revenue FROM orders o
          JOIN tables t ON o.table_id = t.id
          WHERE t.restaurant_id = ? AND o.status = 'billed' AND date(o.created_at) = date('now')
        `).get(restaurantId);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid metric type' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Dashboard metric error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metric' });
  }
});

export default router;