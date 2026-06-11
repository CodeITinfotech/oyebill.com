import express from 'express';
import cors from 'cors';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import db from '../database/index.js';
import authRoutes from './routes/auth.js';
import restaurantRoutes from './routes/restaurants.js';
import categoryRoutes from './routes/categories.js';
import sectionRoutes from './routes/sections.js';
import tableRoutes from './routes/tables.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import settingsRoutes from './routes/settings.js';
import userRoutes from './routes/users.js';
import setupRoutes from './routes/setup.js';
import customerRoutes from './routes/customers.js';
import onlineOrderRoutes from './routes/online-orders.js';
import busserRoutes from './routes/busser.js';
import tableAllocationsRoutes from './routes/table-allocations.js';
import customerOrdersRoutes from './routes/customer-orders.js';
import notificationsRoutes from './routes/notifications.js';
import customerAuthRoutes from './routes/customer-auth.js';
import customerCatalogRoutes from './routes/customer-catalog.js';
import customerOrdersPublicRoutes from './routes/customer-orders-public.js';
import onlineOrderingSettingsRoutes from './routes/online-ordering-settings.js';
import printersRoutes from './routes/printers.js';
import billPdfRoutes from './routes/bill-pdf.js';
import billViewRoutes from './routes/bill-view.js';
import databaseBrowserRoutes from './routes/database-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/online-orders', onlineOrderRoutes);
app.use('/api/busser', busserRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/table-allocations', tableAllocationsRoutes);
app.use('/api/customer-orders', customerOrdersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/customer-auth', customerAuthRoutes);
app.use('/api/catalog', customerCatalogRoutes);
app.use('/api/customer-orders-public', customerOrdersPublicRoutes);
app.use('/api/online-ordering-settings', onlineOrderingSettingsRoutes);
app.use('/api/printers', printersRoutes);
app.use('/api/bill-pdf', billPdfRoutes);
app.use('/api/bill-view', billViewRoutes);
app.use('/api/database', databaseBrowserRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Keep-alive: Self-ping every 5 minutes to prevent container from sleeping
setInterval(() => {
  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 10000
  };
  const req = http.request(options, (res) => {
    console.log('[KEEPALIVE] Self-ping successful:', res.statusCode);
  });
  req.on('error', (e) => {
    console.log('[KEEPALIVE] Self-ping failed:', e.message);
  });
  req.end();
}, 5 * 60 * 1000); // Every 5 minutes

console.log('[KEEPALIVE] Self-ping timer started (every 5 minutes)');

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Oyebill API server running on port ${PORT}`);
});

export default app;