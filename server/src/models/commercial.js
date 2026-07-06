const pool = require('../db/pool');
const { COMMISSION_RATE } = require('./livraison');

/**
 * Get all COMMERCIAL users with aggregated performance stats.
 * Uses CTEs to avoid N+1 queries.
 */
async function getAllWithStats() {
  const { rows } = await pool.query(`
    WITH commercial_stats AS (
      SELECT
        l.commercial_id,
        COUNT(*) AS total_livraisons,
        COUNT(*) FILTER (WHERE l.status IN ('EN_COURS', 'EN_RETOUR')) AS actives,
        COUNT(*) FILTER (WHERE l.status = 'CLOTURE') AS cloturees,
        COUNT(*) FILTER (WHERE l.status = 'ANNULE') AS annulees,
        COUNT(*) FILTER (WHERE l.status = 'EN_RETOUR') AS en_retour
      FROM livraisons l
      WHERE l.is_archived = false
      GROUP BY l.commercial_id
    ),
    commercial_ca AS (
      SELECT
        l.commercial_id,
        COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca_total
      FROM livraisons l
      JOIN livraison_items li ON li.livraison_id = l.id
      WHERE l.status = 'CLOTURE' AND l.is_archived = false
      GROUP BY l.commercial_id
    ),
    commercial_avances AS (
      SELECT
        la.commercial_id,
        COALESCE(SUM(la.amount), 0)::NUMERIC(12,3) AS avances_total
      FROM livraison_avances la
      WHERE la.status = 'ACCEPTE'
      GROUP BY la.commercial_id
    ),
    commercial_prelevements AS (
      SELECT
        p.commercial_id,
        COALESCE(SUM(p.amount), 0)::NUMERIC(12,3) AS prelevements_total
      FROM prelevements p
      WHERE p.commercial_id IS NOT NULL AND p.status = 'VALIDE'
      GROUP BY p.commercial_id
    ),
    commercial_ecoulement AS (
      SELECT
        l.commercial_id,
        l.id AS livraison_id,
        CASE WHEN SUM(li.qte_chargee) > 0
          THEN SUM(li.qte_vendue)::NUMERIC / SUM(li.qte_chargee)::NUMERIC * 100
          ELSE 0
        END AS sell_through
      FROM livraisons l
      JOIN livraison_items li ON li.livraison_id = l.id
      WHERE l.is_archived = false
      GROUP BY l.commercial_id, l.id
    ),
    ecoulement_final AS (
      SELECT commercial_id, ROUND(AVG(sell_through)) AS ecoulement
      FROM commercial_ecoulement
      GROUP BY commercial_id
    )
    SELECT
      u.id, u.full_name, u.vehicle_name, u.vehicle_plate, u.is_active, u.remuneration_type,
      COALESCE(cs.total_livraisons, 0)::INT AS livraisons_total,
      COALESCE(cs.actives, 0)::INT AS livraisons_actives,
      COALESCE(cs.cloturees, 0)::INT AS livraisons_cloturees,
      COALESCE(cs.annulees, 0)::INT AS livraisons_annulees,
      COALESCE(cs.en_retour, 0)::INT AS livraisons_en_retour,
      COALESCE(cca.ca_total, 0)::NUMERIC(12,3) AS ca_total,
      COALESCE(cav.avances_total, 0)::NUMERIC(12,3) AS avances_total,
      COALESCE(cp.prelevements_total, 0)::NUMERIC(12,3) AS prelevements_total,
      COALESCE(ef.ecoulement, 0)::INT AS ecoulement
    FROM users u
    LEFT JOIN commercial_stats cs ON cs.commercial_id = u.id
    LEFT JOIN commercial_ca cca ON cca.commercial_id = u.id
    LEFT JOIN commercial_avances cav ON cav.commercial_id = u.id
    LEFT JOIN commercial_prelevements cp ON cp.commercial_id = u.id
    LEFT JOIN ecoulement_final ef ON ef.commercial_id = u.id
    WHERE u.role = 'COMMERCIAL'
    ORDER BY ca_total DESC
  `);

  return rows;
}

/**
 * Get monthly CA breakdown per commercial (last 6 months of CLOTURE livraisons).
 * Returns { commercial_id: [jan, fev, mar, avr, mai, jun] }
 */
async function getMonthlyCA() {
  const { rows } = await pool.query(`
    SELECT
      l.commercial_id,
      EXTRACT(MONTH FROM l.closed_at)::INT AS month_num,
      COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca
    FROM livraisons l
    JOIN livraison_items li ON li.livraison_id = l.id
    WHERE l.status = 'CLOTURE'
      AND l.is_archived = false
      AND l.closed_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
    GROUP BY l.commercial_id, EXTRACT(MONTH FROM l.closed_at)
    ORDER BY l.commercial_id, month_num
  `);

  // Build map: commercial_id -> { 1: ca, 2: ca, ... }
  const map = {};
  for (const row of rows) {
    if (!map[row.commercial_id]) map[row.commercial_id] = {};
    map[row.commercial_id][row.month_num] = Number(row.ca);
  }
  return map;
}

/**
 * Get livraison history for filtering/comparison.
 * Supports filters: commercial_id, date_from, date_to, status
 */
async function getHistory({ commercial_id, date_from, date_to, status } = {}) {
  let query = `
    SELECT
      l.id, l.reference, l.status, l.created_at, l.closed_at,
      l.commercial_id,
      u.full_name AS commercial_name,
      u.remuneration_type AS commercial_remuneration_type,
      u.vehicle_name, u.vehicle_plate,
      COALESCE(SUM(li.qte_chargee), 0)::INT AS total_charge,
      COALESCE(SUM(li.qte_vendue), 0)::INT AS total_vendu,
      COALESCE(SUM(li.qte_vendue * li.prix_ttc), 0)::NUMERIC(12,3) AS ca,
      COALESCE(SUM(la_total.amount), 0)::NUMERIC(12,3) AS avances
    FROM livraisons l
    JOIN users u ON l.commercial_id = u.id
    LEFT JOIN livraison_items li ON li.livraison_id = l.id
    LEFT JOIN LATERAL (
      SELECT SUM(la.amount) AS amount
      FROM livraison_avances la
      WHERE la.livraison_id = l.id AND la.status = 'ACCEPTE'
    ) la_total ON true
    WHERE l.is_archived = false
  `;
  const params = [];
  let idx = 1;

  if (commercial_id) {
    query += ` AND l.commercial_id = $${idx++}`;
    params.push(commercial_id);
  }

  if (date_from) {
    query += ` AND l.created_at >= $${idx++}`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND l.created_at <= $${idx++}`;
    params.push(date_to);
  }

  if (status && status !== 'all') {
    query += ` AND l.status = $${idx++}`;
    params.push(status);
  }

  query += ` GROUP BY l.id, u.id ORDER BY l.created_at DESC`;

  const { rows } = await pool.query(query, params);

  // Compute derived fields
  return rows.map(row => {
    const charge = Number(row.total_charge);
    const vendu = Number(row.total_vendu);
    const ca = Number(row.ca);
    const avances = Number(row.avances);
    const isSalaire = row.commercial_remuneration_type === 'SALAIRE';
    const commission = isSalaire ? 0 : Number((ca * COMMISSION_RATE).toFixed(3));
    const net = isSalaire ? Number((ca - avances).toFixed(3)) : Number((ca - commission - avances).toFixed(3));
    const ecoulement = charge > 0 ? Math.round((vendu / charge) * 100) : 0;
    const duree = row.closed_at
      ? Math.ceil((new Date(row.closed_at) - new Date(row.created_at)) / (1000 * 60 * 60 * 24))
      : Math.ceil((new Date() - new Date(row.created_at)) / (1000 * 60 * 60 * 24));

    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      date: row.created_at,
      commercial_id: row.commercial_id,
      commercial_name: row.commercial_name,
      commercial_remuneration_type: row.commercial_remuneration_type || 'COMMISSION',
      vehicle_name: row.vehicle_name,
      vehicle_plate: row.vehicle_plate,
      charge,
      vendu,
      ca,
      commission,
      avances,
      net_a_reverser: net,
      ecoulement,
      duree,
    };
  });
}

/**
 * Get status distribution for donut chart.
 * Returns counts per status: CLOTURE, ANNULE, EN_COURS, EN_RETOUR
 */
async function getStatusDistribution(commercial_id) {
  let query = `
    SELECT l.status, COUNT(*)::INT AS count
    FROM livraisons l
    WHERE l.is_archived = false
  `;
  const params = [];
  if (commercial_id) {
    query += ` AND l.commercial_id = $1`;
    params.push(commercial_id);
  }
  query += ` GROUP BY l.status`;

  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getAllWithStats, getMonthlyCA, getHistory, getStatusDistribution };
