require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');

const { runMigrations } = require('./db/migrate');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Trust Railway's reverse proxy in production for correct client IP
if (isProduction) {
  app.set('trust proxy', 1);
}

// ============================================================
// REQUEST ID — attaches unique ID to every request for tracing
// ============================================================
app.use((req, res, next) => {
  const id = req.headers['x-request-id'] || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// ============================================================
// STRUCTURED REQUEST LOGGING
// ============================================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level,
      rid: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: duration,
      ip: req.ip,
      ua: req.headers['user-agent']?.slice(0, 80) || '',
    }));
  });
  next();
});

// ============================================================
// GLOBAL RATE LIMITER — 300 req/min per IP (generous for SPA)
// ============================================================
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Veuillez réessayer dans une minute.' },
  keyGenerator: (req) => req.ip,
});
app.use(globalLimiter);

// ============================================================
// SECURITY HEADERS
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProduction
        ? ["'self'"]                          // production build has no inline scripts
        : ["'self'", "'unsafe-inline'"],      // Vite HMR requires inline in development
      styleSrc: ["'self'", "'unsafe-inline'"], // React style={{}} requires inline style attributes
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ============================================================
// CORS — in production, same-origin only; dev allows Vite
// ============================================================
app.use(cors({
  origin: isProduction
    ? false  // same-origin only in production (client served from same domain)
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ============================================================
// REQUEST TIMEOUT — 30s for all routes
// ============================================================
app.use((req, _res, next) => {
  req.setTimeout(30_000, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });
  next();
});

// ============================================================
// BODY PARSING + COMPRESSION
// ============================================================
app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// STATIC FILES (production only)
// ============================================================
if (isProduction) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');

  // Prevent index.html caching — avoids stale chunk references after deploy
  app.use((req, _res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
      _res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      _res.setHeader('ETag', '');  // suppress ETag to prevent 304 reuse
      _res.removeHeader('Last-Modified');
    }
    next();
  });

  // Hashed assets can be cached aggressively (fingerprinted filenames)
  app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '365d',
    immutable: true,
  }));

  // Serve everything else (index.html, favicon, etc.) with short cache
  app.use(express.static(clientDist, {
    maxAge: '5m',
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('ETag', '');
        res.removeHeader('Last-Modified');
      }
    },
  }));

  console.log('Serving static files from:', clientDist);
}

// ============================================================
// HEALTH CHECK — tests DB connectivity
// ============================================================
app.get('/api/health', async (_req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    db: 'unknown',
  };
  try {
    const pool = require('./db/pool');
    const start = Date.now();
    await pool.query('SELECT 1');
    health.db = { status: 'connected', ms: Date.now() - start };
  } catch (err) {
    health.status = 'degraded';
    health.db = { status: 'disconnected', error: err.message };
    return res.status(503).json(health);
  }
  res.json(health);
});

// ============================================================
// API ROUTES
// ============================================================
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const productsRoutes = require('./routes/products');
const stockRoutes = require('./routes/stock');
const livraisonsRoutes = require('./routes/livraisons');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');
const commercialsRoutes = require('./routes/commercials');
const benefitsRoutes = require('./routes/benefits');
const prelevementsRoutes = require('./routes/prelevements');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/livraisons', livraisonsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/commercials', commercialsRoutes);
app.use('/api/benefits', benefitsRoutes);
app.use('/api/prelevements', prelevementsRoutes);

// ============================================================
// SPA FALLBACK (production) / 404 (dev)
// IMPORTANT: /assets/* paths must NEVER fallback to index.html —
// missing chunk requests must get a clean 404 so the browser can
// retry with a fresh index.html instead of interpreting HTML as JS.
// ============================================================
if (isProduction) {
  // API routes that don't match any route — return 404 JSON
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route API non trouvée' });
  });

  // Missing static assets — return clean 404 (NOT index.html)
  app.use('/assets', (_req, res) => {
    res.status(404).type('text').send('Not found');
  });

  // Everything else → SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });
}

// ============================================================
// GLOBAL ERROR HANDLER — never leaks internals
// ============================================================
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'ERROR',
    rid: req.requestId,
    message: err.message,
    stack: isProduction ? undefined : err.stack?.split('\n').slice(0, 5).join('\n'),
  }));
  res.status(status).json({
    error: status === 500 ? 'Erreur interne du serveur' : err.message,
    rid: req.requestId,
    ...(isProduction ? {} : { detail: err.message }),
  });
});

// ============================================================
// STARTUP — await migrations then listen
// ============================================================
let server;
const connections = new Set();

(async () => {
  // Run idempotent DB migrations BEFORE accepting requests
  // Creates tables, indexes, and seeds 6 categories in one shot
  try {
    await runMigrations();
  } catch (err) {
    console.error('Startup migration error:', err.message);
  }

  server = app.listen(PORT, () => {
    console.log(`Right Way server running on http://localhost:${PORT}`);
    console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
  });

  // Track open connections for draining
  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });
})();

async function shutdown(signal) {
  console.log(`\n[shutdown] ${signal} received. Draining connections...`);

  // Stop accepting new connections
  server.close(() => console.log('[shutdown] Server closed.'));

  // Force-close idle keep-alive connections after 5s
  setTimeout(() => {
    for (const conn of connections) {
      conn.destroy();
    }
  }, 5000).unref();

  // Close DB pool
  try {
    const pool = require('./db/pool');
    await pool.end();
    console.log('[shutdown] Database pool closed.');
  } catch (err) {
    console.error('[shutdown] Error closing pool:', err.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Prevent unhandled rejections from crashing silently
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'FATAL',
    event: 'unhandledRejection',
    message: reason?.message || String(reason),
    stack: reason?.stack?.split('\n').slice(0, 8).join('\n'),
  }));
});

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'FATAL',
    event: 'uncaughtException',
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 8).join('\n'),
  }));

  // Best-effort graceful shutdown: stop accepting connections, drain pool
  try { server.close(); } catch {}
  try {
    const pool = require('./db/pool');
    pool.end().catch(() => {});
  } catch {}

  // Give cleanup a short window, then force exit
  setTimeout(() => process.exit(1), 3000).unref();
});

module.exports = app;
