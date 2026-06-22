require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Routes ---
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const livraisonsRoutes = require('./routes/livraisons');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');

// --- Health Check ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/livraisons', livraisonsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);

// --- 404 Handler ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// --- Global Error Handler ---
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`Right Way server running on http://localhost:${PORT}`);
});

module.exports = app;
