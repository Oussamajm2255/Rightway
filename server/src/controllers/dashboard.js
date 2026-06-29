const pool = require('../db/pool');
const { COMMISSION_RATE } = require('../models/livraison');

// ─── Helpers ───

function buildMonthlyArray(caMap) {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthNum = d.getMonth() + 1;
    months.push(Number((caMap[monthNum] || 0).toFixed(3)));
  }
  return months;
}

function monthLabels() {
  const now = new Date();
  const labels = [];
  const names = ['Janv', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(names[d.getMonth()]);
  }
  return labels;
}

function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] || '?').toUpperCase();
}

// ─── SUPER ADMIN ───

async function superAdminDashboard(req, res) {
  try {
    const [
      users,
      products,
      activeL,
      caTotal,
      alerts,
      monthlyCA,
      statusDist,
      topCommerciaux,
      feedEvents,
      prelevementTotals,
      prelevementTopCats,
      ecartsPendantes,
      ecartsTotals,
      ecartsDetails,
    ] = await Promise.all([
      // KPI: active users
      pool.query('SELECT COUNT(*)::INT AS count FROM users WHERE is_active = true'),
      // KPI: active products
      pool.query('SELECT COUNT(*)::INT AS count FROM products WHERE is_active = true'),
      // KPI: active livraisons
      pool.query("SELECT COUNT(*)::INT AS count FROM livraisons WHERE is_archived = false AND status IN ('EN_COURS','EN_ATTENTE_COMMERCIAL','EN_RETOUR')"),
      // KPI: CA global
      pool.query(`SELECT COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS total
        FROM livraison_items li JOIN livraisons l ON li.livraison_id = l.id
        WHERE l.status = 'CLOTURE' AND l.is_archived = false`),
      // KPI: stock alerts count
      pool.query(`SELECT COUNT(*)::INT AS count
        FROM products p LEFT JOIN depot_stock ds ON p.id = ds.product_id
        WHERE p.is_active = true AND COALESCE(ds.quantity, 0) < 20`),
      // Chart: monthly CA (all commercials, last 6 months)
      pool.query(`SELECT
          EXTRACT(MONTH FROM l.closed_at)::INT AS month_num,
          COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca
        FROM livraisons l
        JOIN livraison_items li ON li.livraison_id = l.id
        WHERE l.status = 'CLOTURE' AND l.is_archived = false
          AND l.closed_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY EXTRACT(MONTH FROM l.closed_at)
        ORDER BY month_num`),
      // Chart: status distribution
      pool.query(`SELECT l.status, COUNT(*)::INT AS count
        FROM livraisons l WHERE l.is_archived = false GROUP BY l.status`),
      // Table: top 5 commerciaux ranked by CA
      pool.query(`
        WITH stats AS (
          SELECT
            l.commercial_id,
            COUNT(*)::INT AS total_livraisons,
            COUNT(*) FILTER (WHERE l.status IN ('EN_COURS','EN_RETOUR'))::INT AS actives,
            COUNT(*) FILTER (WHERE l.status = 'EN_RETOUR')::INT AS en_retour,
            COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca,
            CASE WHEN SUM(li.qte_chargee) > 0
              THEN ROUND(SUM(li.qte_vendue)::NUMERIC / SUM(li.qte_chargee)::NUMERIC * 100)
              ELSE 0 END AS ecoulement
          FROM livraisons l
          JOIN livraison_items li ON li.livraison_id = l.id
          WHERE l.status = 'CLOTURE' AND l.is_archived = false
          GROUP BY l.commercial_id
        )
        SELECT
          u.id, u.full_name, u.is_active,
          COALESCE(s.total_livraisons, 0) AS livraisons,
          COALESCE(s.actives, 0) AS actives,
          COALESCE(s.en_retour, 0) AS en_retour,
          COALESCE(s.ca, 0)::NUMERIC(12,3) AS ca,
          COALESCE(s.ecoulement, 0)::INT AS ecoulement
        FROM users u
        LEFT JOIN stats s ON s.commercial_id = u.id
        WHERE u.role = 'COMMERCIAL'
        ORDER BY s.ca DESC NULLS LAST
        LIMIT 5`),
      // Activity feed: recent events — returns STRUCTURED data (type + params).
      // Never embed user-provided strings into HTML. Frontend renders with safe JSX.
      pool.query(`
        (SELECT
          'check' AS icon,
          'livraison_cloturee' AS type,
          json_build_object('reference', l.reference, 'name', u.full_name) AS params,
          l.closed_at AS event_time
        FROM livraisons l
        JOIN users u ON l.commercial_id = u.id
        WHERE l.status = 'CLOTURE' AND l.is_archived = false
        ORDER BY l.closed_at DESC NULLS LAST LIMIT 5)
        UNION ALL
        (SELECT
          'cash' AS icon,
          'avance_acceptee' AS type,
          json_build_object(
            'amount', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM la.amount::TEXT)),
            'name', u.full_name
          ) AS params,
          la.confirmed_at AS event_time
        FROM livraison_avances la
        JOIN users u ON la.commercial_id = u.id
        WHERE la.status = 'ACCEPTE'
        ORDER BY la.confirmed_at DESC NULLS LAST LIMIT 4)
        UNION ALL
        (SELECT
          'user' AS icon,
          'nouveau_commercial' AS type,
          json_build_object('name', full_name) AS params,
          created_at AS event_time
        FROM users WHERE role = 'COMMERCIAL'
        ORDER BY created_at DESC LIMIT 2)
        UNION ALL
        (SELECT
          'x' AS icon,
          'livraison_annulee' AS type,
          json_build_object('reference', l.reference, 'name', u.full_name) AS params,
          l.annulation_confirmed_by_admin_at AS event_time
        FROM livraisons l
        JOIN users u ON l.commercial_id = u.id
        WHERE l.status = 'ANNULE' AND l.is_archived = false
        ORDER BY l.annulation_confirmed_by_admin_at DESC NULLS LAST LIMIT 2)
        UNION ALL
        (SELECT
          'truck' AS icon,
          'livraison_en_retour' AS type,
          json_build_object('reference', l.reference, 'name', u.full_name) AS params,
          l.retour_confirmed_by_admin_at AS event_time
        FROM livraisons l
        JOIN users u ON l.commercial_id = u.id
        WHERE l.status = 'EN_RETOUR' AND l.is_archived = false
        ORDER BY l.retour_confirmed_by_admin_at DESC NULLS LAST LIMIT 2)
        UNION ALL
        (SELECT
          'package' AS icon,
          'stock_ajuste' AS type,
          json_build_object(
            'product_name', p.name,
            'description',
            CASE WHEN sm.type = 'AJUSTEMENT' AND sm.quantity > 0
              THEN 'ajout de ' || sm.quantity::TEXT || ' unités'
              WHEN sm.type = 'AJUSTEMENT'
              THEN 'retrait de ' || ABS(sm.quantity)::TEXT || ' unités'
              ELSE sm.type END
          ) AS params,
          sm.created_at AS event_time
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        ORDER BY sm.created_at DESC LIMIT 3)
        ORDER BY event_time DESC NULLS LAST
        LIMIT 15`),
      // Prelevement KPIs: totals
      pool.query(`SELECT
          COALESCE(SUM(amount), 0)::NUMERIC(12,3) AS total,
          COUNT(*)::int AS count,
          COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)), 0)::NUMERIC(12,3) AS current_month
        FROM prelevements`),
      // Prelevement KPIs: top 3 categories
      pool.query(`SELECT c.name, COALESCE(SUM(p.amount), 0)::NUMERIC(12,3) AS total, COUNT(p.id)::int AS count
        FROM prelevement_categories c
        JOIN prelevements p ON p.category_id = c.id
        WHERE c.parent_id IS NULL
        GROUP BY c.id, c.name
        ORDER BY total DESC LIMIT 3`),
      // Pending écarts count
      pool.query(`SELECT COUNT(*)::int AS count FROM livraison_ecarts WHERE status = 'PENDING'`),
      // Écarts totals (all statuses)
      pool.query(`SELECT
          COALESCE(SUM(amount), 0)::NUMERIC(12,3) AS total,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
          COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed
        FROM livraison_ecarts`),
      // Écarts details with justifications
      pool.query(`SELECT e.*,
          d.full_name AS declared_by_name,
          c.full_name AS confirmed_by_name,
          l.reference AS livraison_reference
        FROM livraison_ecarts e
        JOIN users d ON e.declared_by = d.id
        LEFT JOIN users c ON e.confirmed_by = c.id
        JOIN livraisons l ON e.livraison_id = l.id
        ORDER BY e.declared_at DESC`),
    ]);

    // Build monthly CA array
    const caMap = {};
    for (const row of monthlyCA.rows) caMap[row.month_num] = Number(row.ca);

    // Build status distribution map
    const statusMap = { CLOTURE: 0, ANNULE: 0, EN_COURS: 0, EN_RETOUR: 0 };
    for (const row of statusDist.rows) {
      if (statusMap.hasOwnProperty(row.status)) statusMap[row.status] = row.count;
    }

    // Enrich top commerciaux
    const top5 = topCommerciaux.rows.map((c, i) => {
      let status = 'INACTIVE';
      if (!c.is_active) status = 'INACTIVE';
      else if (c.actives > 0 && c.en_retour > 0) status = 'EN_RETOUR';
      else if (c.actives > 0) status = 'EN_COURS';
      else status = 'ACTIF';

      const ca = Number(c.ca);
      return {
        rank: i + 1,
        full_name: c.full_name,
        initials: getInitials(c.full_name),
        livraisons: c.livraisons,
        ca,
        ecoulement: c.ecoulement,
        commission: Number((ca * COMMISSION_RATE).toFixed(3)),
        status,
      };
    });

    // Build activity feed — pass structured type + params for safe frontend JSX rendering
    const feed = feedEvents.rows.map(e => ({
      icon: e.icon,
      type: e.type,
      params: e.params,
      time: relativeTime(e.event_time),
    }));

    const caGlobal = Number(caTotal.rows[0].total || 0);

    res.json({
      users_count: users.rows[0].count,
      products_count: products.rows[0].count,
      active_livraisons: activeL.rows[0].count,
      ca_total: caGlobal,
      commissions: Number((caGlobal * COMMISSION_RATE).toFixed(3)),
      stock_alerts_count: alerts.rows[0].count,
      monthly_ca: buildMonthlyArray(caMap),
      monthly_labels: monthLabels(),
      status_distribution: statusMap,
      top_commerciaux: top5,
      activity_feed: feed,
      prelevement_total: Number(prelevementTotals.rows[0]?.total || 0),
      prelevement_count: prelevementTotals.rows[0]?.count || 0,
      prelevement_current_month: Number(prelevementTotals.rows[0]?.current_month || 0),
      prelevement_top_categories: prelevementTopCats.rows.map(r => ({
        name: r.name,
        total: Number(r.total),
        count: r.count,
      })),
      ecarts_en_attente: ecartsPendantes.rows[0]?.count || 0,
      ecarts_total: Number(ecartsTotals.rows[0]?.total || 0),
      ecarts_count: ecartsTotals.rows[0]?.count || 0,
      ecarts_pending_count: ecartsTotals.rows[0]?.pending || 0,
      ecarts_confirmed_count: ecartsTotals.rows[0]?.confirmed || 0,
      ecarts: ecartsDetails.rows.map(r => ({
        id: r.id,
        livraison_id: r.livraison_id,
        livraison_reference: r.livraison_reference,
        amount: Number(r.amount),
        justification: r.justification,
        declared_by_name: r.declared_by_name,
        confirmed_by_name: r.confirmed_by_name,
        status: r.status,
        declared_at: r.declared_at,
        confirmed_at: r.confirmed_at,
      })),
    });
  } catch (err) {
    console.error('superAdminDashboard error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ─── ADMIN ───

async function adminDashboard(req, res) {
  try {
    const adminId = req.user.id;

    const [
      stockCount,
      activeL,
      pendingL,
      caPeriod,
      alerts,
      notifCount,
      monthlyCA,
      statusDist,
    ] = await Promise.all([
      // KPI: stock
      pool.query('SELECT COUNT(*)::INT AS count, COALESCE(SUM(quantity), 0)::INT AS total_qty FROM depot_stock WHERE quantity > 0'),
      // KPI: active livraisons
      pool.query("SELECT COUNT(*)::INT AS count FROM livraisons WHERE admin_id = $1 AND is_archived = false AND status IN ('EN_COURS','EN_RETOUR')", [adminId]),
      // KPI: pending
      pool.query("SELECT COUNT(*)::INT AS count FROM livraisons WHERE admin_id = $1 AND is_archived = false AND status = 'EN_ATTENTE_COMMERCIAL'", [adminId]),
      // KPI: CA this month
      pool.query(`SELECT COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS total
        FROM livraison_items li
        JOIN livraisons l ON li.livraison_id = l.id
        WHERE l.admin_id = $1 AND l.status = 'CLOTURE' AND l.is_archived = false
          AND l.closed_at >= DATE_TRUNC('month', CURRENT_DATE)`, [adminId]),
      // Stock alerts with code + category
      pool.query(`SELECT p.id, p.name, p.id AS code, p.category,
          COALESCE(ds.quantity, 0)::INT AS quantity
        FROM products p
        LEFT JOIN depot_stock ds ON p.id = ds.product_id
        WHERE p.is_active = true AND COALESCE(ds.quantity, 0) < 20
        ORDER BY quantity`),
      // Unread notifications
      pool.query('SELECT COUNT(*)::INT AS count FROM notifications WHERE user_id = $1 AND is_read = false', [adminId]),
      // Chart: monthly CA
      pool.query(`SELECT
          EXTRACT(MONTH FROM l.closed_at)::INT AS month_num,
          COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca
        FROM livraisons l
        JOIN livraison_items li ON li.livraison_id = l.id
        WHERE l.admin_id = $1 AND l.status = 'CLOTURE' AND l.is_archived = false
          AND l.closed_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY EXTRACT(MONTH FROM l.closed_at)
        ORDER BY month_num`, [adminId]),
      // Chart: status distribution
      pool.query(`SELECT l.status, COUNT(*)::INT AS count
        FROM livraisons l
        WHERE l.admin_id = $1 AND l.is_archived = false
        GROUP BY l.status`, [adminId]),
    ]);

    const caMap = {};
    for (const row of monthlyCA.rows) caMap[row.month_num] = Number(row.ca);

    const statusMap = { CLOTURE: 0, ANNULE: 0, EN_COURS: 0, EN_RETOUR: 0 };
    for (const row of statusDist.rows) {
      if (statusMap.hasOwnProperty(row.status)) statusMap[row.status] = row.count;
    }

    res.json({
      stock_products: stockCount.rows[0].count,
      stock_total_qty: stockCount.rows[0].total_qty,
      active_livraisons: activeL.rows[0].count,
      pending_livraisons: pendingL.rows[0].count,
      ca_period: Number(caPeriod.rows[0].total || 0),
      stock_alerts: alerts.rows,
      unread_notifications: notifCount.rows[0].count,
      monthly_ca: buildMonthlyArray(caMap),
      monthly_labels: monthLabels(),
      status_distribution: statusMap,
    });
  } catch (err) {
    console.error('adminDashboard error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ─── COMMERCIAL ───

async function commercialDashboard(req, res) {
  try {
    const commercialId = req.user.id;

    const [
      caData,
      avancesData,
      completionData,
      enCours,
      pendingSortie,
      notifCount,
      monthlyCA,
      statusDist,
      recentLivs,
    ] = await Promise.all([
      // KPI: CA total
      pool.query(`SELECT COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS total
        FROM livraison_items li
        JOIN livraisons l ON li.livraison_id = l.id
        WHERE l.commercial_id = $1 AND l.status = 'CLOTURE' AND l.is_archived = false`, [commercialId]),
      // KPI: avances acceptées
      pool.query(`SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,3) AS total
        FROM livraison_avances WHERE commercial_id = $1 AND status = 'ACCEPTE'`, [commercialId]),
      // KPI: completion
      pool.query(`SELECT
          COUNT(*)::INT AS total,
          COUNT(*) FILTER (WHERE status = 'CLOTURE')::INT AS cloturees
        FROM livraisons
        WHERE commercial_id = $1 AND is_archived = false`, [commercialId]),
      // Active delivery with items
      pool.query(`SELECT
          l.id, l.reference, l.created_at, l.status,
          COALESCE(SUM(li.qte_chargee), 0)::INT AS charge,
          COALESCE(SUM(li.qte_vendue), 0)::INT AS vendu,
          COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca
        FROM livraisons l
        LEFT JOIN livraison_items li ON li.livraison_id = l.id
        WHERE l.commercial_id = $1 AND l.status = 'EN_COURS' AND l.is_archived = false
        GROUP BY l.id
        ORDER BY l.created_at DESC LIMIT 1`, [commercialId]),
      // Pending bons
      pool.query(`SELECT l.id, l.reference, l.created_at, a.full_name AS admin_name
        FROM livraisons l
        JOIN users a ON l.admin_id = a.id
        WHERE l.commercial_id = $1 AND l.status = 'EN_ATTENTE_COMMERCIAL' AND l.is_archived = false
        ORDER BY l.created_at DESC`, [commercialId]),
      // Unread notifications
      pool.query('SELECT COUNT(*)::INT AS count FROM notifications WHERE user_id = $1 AND is_read = false', [commercialId]),
      // Chart: monthly CA
      pool.query(`SELECT
          EXTRACT(MONTH FROM l.closed_at)::INT AS month_num,
          COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca
        FROM livraisons l
        JOIN livraison_items li ON li.livraison_id = l.id
        WHERE l.commercial_id = $1 AND l.status = 'CLOTURE' AND l.is_archived = false
          AND l.closed_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY EXTRACT(MONTH FROM l.closed_at)
        ORDER BY month_num`, [commercialId]),
      // Chart: status distribution
      pool.query(`SELECT l.status, COUNT(*)::INT AS count
        FROM livraisons l
        WHERE l.commercial_id = $1 AND l.is_archived = false
        GROUP BY l.status`, [commercialId]),
      // Recent livraisons with items
      pool.query(`SELECT
          l.id, l.reference, l.status, l.created_at,
          COALESCE(SUM(li.qte_chargee), 0)::INT AS charge,
          COALESCE(SUM(li.qte_vendue), 0)::INT AS vendu,
          COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca
        FROM livraisons l
        LEFT JOIN livraison_items li ON li.livraison_id = l.id
        WHERE l.commercial_id = $1 AND l.is_archived = false
        GROUP BY l.id
        ORDER BY l.created_at DESC LIMIT 10`, [commercialId]),
    ]);

    const caTotal = Number(caData.rows[0].total || 0);
    const avancesAcceptees = Number(avancesData.rows[0].total || 0);
    const totalLivs = completionData.rows[0].total;
    const cloturees = completionData.rows[0].cloturees;
    const completionRate = totalLivs > 0 ? Math.round((cloturees / totalLivs) * 100) : 0;

    // Enrich active delivery
    const active = enCours.rows[0] || null;
    if (active) {
      active.charge = active.charge || 0;
      active.vendu = active.vendu || 0;
      active.ca = Number(active.ca || 0);
      active.ecoulement = active.charge > 0 ? Math.round((active.vendu / active.charge) * 100) : 0;
    }

    // Enrich recent livraisons
    const recent = recentLivs.rows.map(l => {
      const charge = l.charge || 0;
      const vendu = l.vendu || 0;
      const ca = Number(l.ca || 0);
      return {
        id: l.id,
        reference: l.reference,
        status: l.status,
        created_at: l.created_at,
        charge,
        vendu,
        ca,
        ecoulement: charge > 0 ? Math.round((vendu / charge) * 100) : 0,
      };
    });

    // Monthly CA
    const caMap = {};
    for (const row of monthlyCA.rows) caMap[row.month_num] = Number(row.ca);

    // Status distribution
    const statusMap = { CLOTURE: 0, ANNULE: 0, EN_COURS: 0, EN_RETOUR: 0 };
    for (const row of statusDist.rows) {
      if (statusMap.hasOwnProperty(row.status)) statusMap[row.status] = row.count;
    }

    res.json({
      ca_total: caTotal,
      commission: Number((caTotal * COMMISSION_RATE).toFixed(3)),
      completion_rate: completionRate,
      completion_details: { cloturees, total: totalLivs },
      en_tournee: active ? 1 : 0,
      avances_acceptees: avancesAcceptees,
      active_livraison: active,
      pending_bons: pendingSortie.rows,
      unread_notifications: notifCount.rows[0].count,
      monthly_ca: buildMonthlyArray(caMap),
      monthly_labels: monthLabels(),
      status_distribution: statusMap,
      recent_livraisons: recent,
    });
  } catch (err) {
    console.error('commercialDashboard error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ─── Relative time helper ───

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Il y a 1j';
  return `Il y a ${diffD}j`;
}

module.exports = { superAdminDashboard, adminDashboard, commercialDashboard };
