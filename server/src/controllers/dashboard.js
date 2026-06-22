const pool = require('../db/pool');

async function superAdminDashboard(req, res) {
  try {
    const [users, products, activeL, caTotal, alerts] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM users WHERE is_active = true'),
      pool.query('SELECT COUNT(*) AS count FROM products WHERE is_active = true'),
      pool.query("SELECT COUNT(*) AS count FROM livraisons WHERE status IN ('EN_COURS','EN_ATTENTE_COMMERCIAL','EN_RETOUR')"),
      pool.query('SELECT COALESCE(SUM(qte_vendue * prix_ttc), 0)::NUMERIC(10,3) AS total FROM livraison_items li JOIN livraisons l ON li.livraison_id = l.id WHERE l.status = \'CLOTURE\''),
      pool.query('SELECT p.id, p.name, COALESCE(ds.quantity, 0) AS quantity FROM products p LEFT JOIN depot_stock ds ON p.id = ds.product_id WHERE p.is_active = true AND COALESCE(ds.quantity, 0) < 20 ORDER BY quantity'),
    ]);

    res.json({
      users_count: parseInt(users.rows[0].count, 10),
      products_count: parseInt(products.rows[0].count, 10),
      active_livraisons: parseInt(activeL.rows[0].count, 10),
      ca_total: Number(caTotal.rows[0].total || 0),
      stock_alerts: alerts.rows,
    });
  } catch (err) {
    console.error('superAdminDashboard error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function adminDashboard(req, res) {
  try {
    const adminId = req.user.id;

    const [stockCount, activeL, pendingL, alerts, notifCount] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count, SUM(quantity) AS total_qty FROM depot_stock WHERE quantity > 0'),
      pool.query("SELECT COUNT(*) AS count FROM livraisons WHERE admin_id = $1 AND status IN ('EN_COURS','EN_RETOUR')", [adminId]),
      pool.query("SELECT COUNT(*) AS count FROM livraisons WHERE admin_id = $1 AND status = 'EN_ATTENTE_COMMERCIAL'", [adminId]),
      pool.query('SELECT p.id, p.name, COALESCE(ds.quantity, 0) AS quantity FROM products p LEFT JOIN depot_stock ds ON p.id = ds.product_id WHERE p.is_active = true AND COALESCE(ds.quantity, 0) < 20 ORDER BY quantity'),
      pool.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false', [adminId]),
    ]);

    res.json({
      stock_products: parseInt(stockCount.rows[0].count, 10),
      stock_total_qty: parseInt(stockCount.rows[0].total_qty || 0, 10),
      active_livraisons: parseInt(activeL.rows[0].count, 10),
      pending_livraisons: parseInt(pendingL.rows[0].count, 10),
      stock_alerts: alerts.rows,
      unread_notifications: parseInt(notifCount.rows[0].count, 10),
    });
  } catch (err) {
    console.error('adminDashboard error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function commercialDashboard(req, res) {
  try {
    const commercialId = req.user.id;

    const [pendingSortie, enCours, recentLivs, caData, notifCount] = await Promise.all([
      pool.query("SELECT l.id, l.reference, l.created_at, a.full_name AS admin_name FROM livraisons l JOIN users a ON l.admin_id = a.id WHERE l.commercial_id = $1 AND l.status = 'EN_ATTENTE_COMMERCIAL' ORDER BY l.created_at DESC", [commercialId]),
      pool.query("SELECT l.id, l.reference, l.created_at FROM livraisons l WHERE l.commercial_id = $1 AND l.status = 'EN_COURS' ORDER BY l.created_at DESC LIMIT 1", [commercialId]),
      pool.query("SELECT l.id, l.reference, l.status, l.created_at, l.closed_at FROM livraisons l WHERE l.commercial_id = $1 ORDER BY l.created_at DESC LIMIT 10", [commercialId]),
      pool.query("SELECT COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(10,3) AS total FROM livraison_items li JOIN livraisons l ON li.livraison_id = l.id WHERE l.commercial_id = $1 AND l.status = 'CLOTURE'", [commercialId]),
      pool.query('SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false', [commercialId]),
    ]);

    const caTotal = Number(caData.rows[0].total || 0);
    const commission = Number((caTotal * 0.10).toFixed(3));

    res.json({
      pending_bons: pendingSortie.rows,
      active_livraison: enCours.rows[0] || null,
      recent_livraisons: recentLivs.rows,
      ca_total: caTotal,
      commission,
      unread_notifications: parseInt(notifCount.rows[0].count, 10),
    });
  } catch (err) {
    console.error('commercialDashboard error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { superAdminDashboard, adminDashboard, commercialDashboard };
