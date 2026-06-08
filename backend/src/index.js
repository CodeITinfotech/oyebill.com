import express from 'express';
import cors from 'cors';
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
app.use('/api/setup', setupRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Oyebill API server running on port ${PORT}`);
});

export default app;