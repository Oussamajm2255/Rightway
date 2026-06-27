const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 20,          // max concurrent clients
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS, 10) || 30_000,  // close idle after 30s
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_MS, 10) || 10_000, // fail after 10s
  maxUses: 7500,                                             // recycle connection after 7.5k queries
  allowExitOnIdle: true,                                      // allow Node to exit even if pool has idle
});

pool.on('error', (err) => {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'ERROR',
    component: 'db-pool',
    message: err.message,
  }));
});

module.exports = pool;
