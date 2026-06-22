require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust Railway's reverse proxy in production for correct client IP
if (isProduction) {
  app.set('trust proxy', 1);
}

// --- Middleware ---
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for Vite build
  crossOriginEmbedderPolicy: false,
}));

// In production, allow all origins since client is served from same domain.
// In development, limit to localhost.
app.use(cors({
  origin: isProduction ? true : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Serve client build in production ---
if (isProduction) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  console.log('Serving static files from:', clientDist);
}

// --- API Routes ---
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const livraisonsRoutes = require('./routes/livraisons');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');

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

// --- SPA fallback (production only) ---
if (isProduction) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
  });
} else {
  // 404 for API routes in dev
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });
}

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
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});

module.exports = app;
