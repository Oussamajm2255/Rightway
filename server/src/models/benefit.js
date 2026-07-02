const pool = require('../db/pool');

/**
 * Global benefits KPIs — aggregated from all CLOTURE non-archived livraisons.
 * Accepts optional date range to scope metrics.
 */
async function getGlobalBenefits({ date_from, date_to } = {}) {
  const params = [];
  let idx = 1;

  let dateWhere = '';
  let prelevDateWhere = '';
  let ecartDateWhere = '';

  if (date_from) {
    dateWhere += ` AND l.closed_at::date >= $${idx}`;
    prelevDateWhere += ` AND expense_date >= $${idx}`;
    ecartDateWhere += ` AND declared_at::date >= $${idx}`;
    params.push(date_from); idx++;
  }
  if (date_to) {
    dateWhere += ` AND l.closed_at::date <= $${idx}`;
    prelevDateWhere += ` AND expense_date <= $${idx}`;
    ecartDateWhere += ` AND declared_at::date <= $${idx}`;
    params.push(date_to); idx++;
  }

  const query = `
    WITH product_sales AS (
      SELECT
        li.product_id,
        SUM(li.qte_vendue * li.prix_ttc)                       AS ca,
        SUM(li.qte_vendue * p.purchase_price)                  AS cost,
        SUM(li.qte_vendue * (li.prix_ttc - p.purchase_price))  AS benefit
      FROM livraison_items li
      JOIN livraisons l ON li.livraison_id = l.id
      JOIN products p   ON li.product_id = p.id
      JOIN users u      ON l.commercial_id = u.id AND u.remuneration_type = 'COMMISSION'
      WHERE l.status = 'CLOTURE' AND l.is_archived = false
        ${dateWhere}
      GROUP BY li.product_id
    ),
    prelevement_total AS (
      SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,3) AS total
      FROM prelevements
      WHERE 1=1 ${prelevDateWhere}
    ),
    ecart_total AS (
      SELECT COALESCE(SUM(amount), 0)::NUMERIC(12,3) AS total
      FROM livraison_ecarts
      WHERE 1=1 ${ecartDateWhere}
    )
    SELECT
      COALESCE(SUM(ps.ca), 0)::NUMERIC(12,3)            AS ca_total,
      COALESCE(SUM(ps.benefit), 0)::NUMERIC(12,3)       AS benefit_gross,
      (SELECT total FROM prelevement_total)              AS prelevement_total,
      (SELECT total FROM ecart_total)                    AS ecart_total,
      COALESCE(SUM(ps.benefit), 0)::NUMERIC(12,3)
        - (SELECT total FROM prelevement_total)
        - (SELECT total FROM ecart_total)                 AS benefit_net,
      CASE WHEN SUM(ps.ca) > 0
        THEN ROUND((SUM(ps.benefit) / SUM(ps.ca)) * 100, 1)
        ELSE 0 END                                       AS margin_avg,
      COUNT(*) FILTER (WHERE ps.benefit > 0)::INT        AS profitable_count
    FROM product_sales ps
  `;

  const { rows } = await pool.query(query, params);
  return rows[0] || { ca_total: 0, benefit_gross: 0, prelevement_total: 0, ecart_total: 0, benefit_net: 0, margin_avg: 0, profitable_count: 0 };
}

/**
 * Product-level benefit breakdown.
 * Supports filters, sort, and pagination — mirrors the frontend table.
 */
async function getProductBenefits({
  category, search, date_from, date_to,
  sort_by = 'benefit', sort_dir = 'desc',
  page = 1, limit = 50,
} = {}) {
  // Whitelist sort columns (prevent injection)
  const ALLOWED_SORTS = [
    'id', 'name', 'category', 'purchase_price', 'selling_price_ttc',
    'total_sold', 'ca', 'cost', 'benefit', 'margin_pct',
  ];
  const col = ALLOWED_SORTS.includes(sort_by) ? sort_by : 'benefit';
  const dir = sort_dir === 'asc' ? 'ASC' : 'DESC';

  const params = [];
  let filterIdx = 1;

  // Build date filter for CTE
  let dateWhere = '';
  if (date_from) { dateWhere += ` AND l.closed_at::date >= $${filterIdx++}`; params.push(date_from); }
  if (date_to)   { dateWhere += ` AND l.closed_at::date <= $${filterIdx++}`; params.push(date_to);   }

  // Build product-level filters
  let productWhere = '';
  if (category) { productWhere += ` AND p.category = $${filterIdx++}`; params.push(category); }
  if (search)   { productWhere += ` AND (p.name ILIKE $${filterIdx} OR p.id ILIKE $${filterIdx})`;
                   params.push(`%${search}%`); filterIdx++; }

  const offset = (page - 1) * limit;

  // Pass limit/offset as last params
  params.push(limit, offset);

  const query = `
    WITH product_sales AS (
      SELECT
        li.product_id,
        SUM(li.qte_vendue)::INT                                 AS total_sold,
        SUM(li.qte_vendue * li.prix_ttc)::NUMERIC(12,3)        AS ca,
        SUM(li.qte_vendue * p2.purchase_price)::NUMERIC(12,3)  AS cost,
        SUM(li.qte_vendue * (li.prix_ttc - p2.purchase_price))
          ::NUMERIC(12,3)                                       AS benefit
      FROM livraison_items li
      JOIN livraisons l ON li.livraison_id = l.id
      JOIN products p2  ON li.product_id = p2.id
      WHERE l.status = 'CLOTURE' AND l.is_archived = false
        ${dateWhere}
      GROUP BY li.product_id
    )
    SELECT
      p.id, p.barcode, p.name, p.category,
      p.purchase_price, p.selling_price_ttc,
      COALESCE(ps.total_sold, 0)  AS total_sold,
      COALESCE(ps.ca, 0)          AS ca,
      COALESCE(ps.cost, 0)        AS cost,
      COALESCE(ps.benefit, 0)     AS benefit,
      CASE WHEN COALESCE(ps.ca, 0) > 0
        THEN ROUND((COALESCE(ps.benefit, 0) / ps.ca) * 100, 1)
        ELSE 0 END                AS margin_pct,
      COUNT(*) OVER()::INT        AS total_count
    FROM products p
    LEFT JOIN product_sales ps ON p.id = ps.product_id
    WHERE p.is_active = true
      ${productWhere}
    ORDER BY ${col} ${dir}, p.name ASC
    LIMIT $${filterIdx++} OFFSET $${filterIdx}
  `;

  const { rows } = await pool.query(query, params);
  const total = rows.length > 0 ? rows[0].total_count : 0;

  // Strip total_count from rows before returning
  const products = rows.map(({ total_count, ...rest }) => rest);

  return { products, total };
}

module.exports = { getGlobalBenefits, getProductBenefits };
