const pool = require('../db/pool');
const COMMISSION_RATE = 0.10;  // 10% — single source of truth

/**
 * Generate reference: LIV-YYYYMMDD-NNN with daily counter.
 * Uses pg_advisory_lock to serialize same-day reference generation.
 * When a client is passed (transactional use), the lock stays held after
 * this function returns — the caller MUST release it after the INSERT.
 * When no client is passed (standalone use), this function manages the
 * lock lifecycle fully.
 */
async function generateReference(clientParam) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LIV-${dateStr}-`;
  const lockKey = Math.abs(hashCode(dateStr)) % 2147483647;

  const ownsClient = !clientParam;
  const client = clientParam || await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);

    const { rows } = await client.query(
      `SELECT reference FROM livraisons
       WHERE reference LIKE $1
       ORDER BY reference DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let nextNum = 1;
    if (rows.length > 0) {
      const lastRef = rows[0].reference;
      const lastNum = parseInt(lastRef.split('-').pop(), 10);
      nextNum = lastNum + 1;
    }

    const reference = `${prefix}${String(nextNum).padStart(3, '0')}`;

    // Standalone use: release lock now (backward compatible).
    // Transactional use: caller releases after INSERT.
    if (ownsClient) {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    }

    return reference;
  } finally {
    if (ownsClient) {
      client.release();
    }
  }
}

/**
 * Simple string hash for advisory lock key generation
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Create a new livraison with items.
 * Does NOT deduct stock — that happens on commercial confirmation.
 * Validates stock availability and resolves prices within the transaction
 * to eliminate TOCTOU between check and create.
 */
async function create({ commercial_id, admin_id, items }) {
  const client = await pool.connect();
  // Advisory lock key for this date (must match generateReference's key)
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const lockKey = Math.abs(hashCode(dateStr)) % 2147483647;
  try {
    await client.query('BEGIN');

    // generateReference acquires the lock on our client and holds it —
    // we must release it after the INSERT below.
    const reference = await generateReference(client);

    // Validate stock and resolve prices WITHIN the transaction (FOR UPDATE)
    for (const item of items) {
      const { rows: stockRows } = await client.query(
        'SELECT quantity FROM depot_stock WHERE product_id = $1 FOR UPDATE',
        [item.product_id]
      );
      const available = stockRows.length > 0 ? stockRows[0].quantity : 0;
      if (item.qte_chargee > available) {
        const { rows: prodRows } = await client.query(
          'SELECT name FROM products WHERE id = $1', [item.product_id]
        );
        const pname = prodRows.length > 0 ? prodRows[0].name : item.product_id;
        throw Object.assign(
          new Error(`Stock insuffisant pour "${pname}". Disponible: ${available}, Demandé: ${item.qte_chargee}.`),
          { status: 400 }
        );
      }

      const { rows: priceRows } = await client.query(
        'SELECT selling_price_ttc FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );
      if (priceRows.length === 0) {
        throw Object.assign(
          new Error(`Produit ${item.product_id} introuvable.`),
          { status: 400 }
        );
      }
      item.prix_ttc = priceRows[0].selling_price_ttc;
    }

    const { rows: livRows } = await client.query(
      `INSERT INTO livraisons (reference, commercial_id, admin_id, status)
       VALUES ($1, $2, $3, 'EN_ATTENTE_COMMERCIAL')
       RETURNING *`,
      [reference, commercial_id, admin_id]
    );
    const livraison = livRows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO livraison_items (livraison_id, product_id, qte_chargee, prix_ttc)
         VALUES ($1, $2, $3, $4)`,
        [livraison.id, item.product_id, item.qte_chargee, item.prix_ttc]
      );
    }

    // Release advisory lock now that INSERT is done
    await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);

    await client.query('COMMIT');
    return livraison;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Safety: release lock even on error paths
    try { await client.query('SELECT pg_advisory_unlock($1)', [lockKey]); } catch {}
    client.release();
  }
}

/**
 * Find livraison by ID with items, commercial, and admin info
 */
async function findById(id) {
  const { rows: livRows } = await pool.query(
    `SELECT l.*,
            c.full_name AS commercial_name, c.vehicle_name, c.vehicle_plate, c.phone AS commercial_phone,
            a.full_name AS admin_name
     FROM livraisons l
     JOIN users c ON l.commercial_id = c.id
     JOIN users a ON l.admin_id = a.id
     WHERE l.id = $1`,
    [id]
  );
  if (livRows.length === 0) return null;

  const livraison = livRows[0];

  const { rows: items } = await pool.query(
    `SELECT li.*, p.barcode, p.name AS product_name, p.category
     FROM livraison_items li
     JOIN products p ON li.product_id = p.id
     WHERE li.livraison_id = $1
     ORDER BY p.category, p.name`,
    [id]
  );
  livraison.items = items;

  // Load avances
  const { rows: avances } = await pool.query(
    `SELECT la.*,
            c.full_name AS commercial_name,
            a.full_name AS admin_name
     FROM livraison_avances la
     LEFT JOIN users c ON la.commercial_id = c.id
     LEFT JOIN users a ON la.admin_id = a.id
     WHERE la.livraison_id = $1
     ORDER BY la.created_at DESC`,
    [id]
  );
  livraison.avances = avances;

  return livraison;
}

/**
 * List livraisons with filters
 */
async function findAll({ status, commercial_id, date_from, date_to, admin_id, include_archived, limit = 100, offset = 0 } = {}) {
  let query = `
    SELECT l.reference, l.id, l.status, l.created_at, l.closed_at, l.is_archived,
           c.full_name AS commercial_name, c.vehicle_name, c.vehicle_plate,
           a.full_name AS admin_name
    FROM livraisons l
    JOIN users c ON l.commercial_id = c.id
    JOIN users a ON l.admin_id = a.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  // Exclude archived by default
  if (!include_archived) {
    query += ` AND l.is_archived = false`;
  }

  if (status) {
    query += ` AND l.status = $${idx++}`;
    params.push(status);
  }

  if (commercial_id) {
    query += ` AND l.commercial_id = $${idx++}`;
    params.push(commercial_id);
  }

  if (admin_id) {
    query += ` AND l.admin_id = $${idx++}`;
    params.push(admin_id);
  }

  if (date_from) {
    query += ` AND l.created_at >= $${idx++}`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND l.created_at <= $${idx++}`;
    params.push(date_to);
  }

  query += ` ORDER BY l.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Commercial confirms Bon de Sortie — ATOMIC TRANSACTION
 * Deducts stock, writes movements, changes status, sets timestamp
 */
async function confirmSortie(id, commercial_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify status
    const { rows: livRows } = await client.query(
      'SELECT * FROM livraisons WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (livRows.length === 0) {
      await client.query('ROLLBACK');
      return { error: 'Livraison introuvable.' };
    }
    if (livRows[0].status !== 'EN_ATTENTE_COMMERCIAL') {
      await client.query('ROLLBACK');
      return { error: `Impossible de confirmer. Statut actuel: ${livRows[0].status}.` };
    }
    if (livRows[0].commercial_id !== commercial_id) {
      await client.query('ROLLBACK');
      return { error: 'Cette livraison ne vous est pas assignée.' };
    }

    // Get items
    const { rows: items } = await client.query(
      'SELECT * FROM livraison_items WHERE livraison_id = $1',
      [id]
    );

    // Deduct stock for each item — SELECT FOR UPDATE first to avoid
    // PostgreSQL CHECK constraint errors producing opaque 500 responses.
    for (const item of items) {
      const { rows: stockRows } = await client.query(
        'SELECT quantity FROM depot_stock WHERE product_id = $1 FOR UPDATE',
        [item.product_id]
      );
      const available = stockRows.length > 0 ? stockRows[0].quantity : 0;
      if (available < item.qte_chargee) {
        await client.query('ROLLBACK');
        return { error: `Stock insuffisant pour le produit ${item.product_id}. Disponible: ${available}, Demandé: ${item.qte_chargee}.` };
      }

      await client.query(
        `UPDATE depot_stock
         SET quantity = $1, last_updated = NOW()
         WHERE product_id = $2`,
        [available - item.qte_chargee, item.product_id]
      );
    }

    // Write stock movements (SORTIE)
    for (const item of items) {
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, livraison_id, created_by)
         VALUES ($1, 'SORTIE', $2, $3, $4)`,
        [item.product_id, item.qte_chargee, id, commercial_id]
      );
    }

    // Update livraison status
    const now = new Date().toISOString();
    await client.query(
      `UPDATE livraisons
       SET status = 'EN_COURS', confirmed_by_commercial_at = $2
       WHERE id = $1`,
      [id, now]
    );

    await client.query('COMMIT');

    const livraison = await findById(id);
    return { livraison };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// SALES FUNCTIONS
// ============================================================

/**
 * Get current sales state for a livraison
 */
async function getSalesState(id) {
  const { rows } = await pool.query(
    `SELECT li.*, p.barcode, p.name AS product_name, p.category
     FROM livraison_items li
     JOIN products p ON li.product_id = p.id
     WHERE li.livraison_id = $1
     ORDER BY p.category, p.name`,
    [id]
  );
  return rows;
}

/**
 * Record sales delta for a specific product.
 * Writes to sales log and updates qte_vendue.
 * When clientParam is provided, uses the caller's transaction (does NOT commit/release).
 * When not provided, creates its own transaction (standalone use, backward compatible).
 */
async function recordSales(livraison_id, product_id, new_qte_vendue, clientParam) {
  const ownsClient = !clientParam;
  const client = clientParam || await pool.connect();
  try {
    if (ownsClient) await client.query('BEGIN');

    // Get current item
    const { rows: itemRows } = await client.query(
      'SELECT qte_chargee, qte_vendue FROM livraison_items WHERE livraison_id = $1 AND product_id = $2 FOR UPDATE',
      [livraison_id, product_id]
    );
    if (itemRows.length === 0) {
      if (ownsClient) await client.query('ROLLBACK');
      return { error: 'Produit non trouvé dans cette livraison.' };
    }

    const { qte_chargee, qte_vendue: current_vendue } = itemRows[0];

    if (new_qte_vendue < 0 || new_qte_vendue > qte_chargee) {
      if (ownsClient) await client.query('ROLLBACK');
      return { error: `Quantité vendue invalide. Doit être entre 0 et ${qte_chargee}.` };
    }

    const delta = new_qte_vendue - current_vendue;

    // Update qte_vendue
    await client.query(
      'UPDATE livraison_items SET qte_vendue = $1 WHERE livraison_id = $2 AND product_id = $3',
      [new_qte_vendue, livraison_id, product_id]
    );

    // Log delta if changed
    if (delta !== 0) {
      await client.query(
        `INSERT INTO livraison_sales_log (livraison_id, product_id, delta)
         VALUES ($1, $2, $3)`,
        [livraison_id, product_id, delta]
      );
    }

    if (ownsClient) await client.query('COMMIT');

    // Compute total CA server-side
    const { rows: caRows } = await client.query(
      `SELECT SUM(qte_vendue * prix_ttc) AS ca_total
       FROM livraison_items WHERE livraison_id = $1`,
      [livraison_id]
    );

    return { delta, qte_vendue: new_qte_vendue, ca_total: Number(caRows[0].ca_total || 0) };
  } catch (err) {
    if (ownsClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (ownsClient) client.release();
  }
}

/**
 * Sync offline sales queue — process array of {product_id, qte_vendue}
 * in a SINGLE transaction. If any sale fails validation, all roll back.
 * Per-item results are preserved for the caller.
 */
async function syncSales(livraison_id, sales) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const sale of sales) {
      const result = await recordSales(livraison_id, sale.product_id, sale.qte_vendue, client);
      if (result.error) {
        await client.query('ROLLBACK');
        return { error: result.error, item: sale };
      }
      results.push(result);
    }
    await client.query('COMMIT');

    // Single CA query after commit
    const { rows: caRows } = await pool.query(
      'SELECT SUM(qte_vendue * prix_ttc)::NUMERIC(10,3) AS ca_total FROM livraison_items WHERE livraison_id = $1',
      [livraison_id]
    );

    return { results, ca_total: Number(caRows[0].ca_total || 0) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get real-time monitoring data for a livraison.
 * Aggregates sales per category.
 */
async function getRealtimeData(id) {
  const { rows: livRows } = await pool.query(
    'SELECT reference, status FROM livraisons WHERE id = $1', [id]
  );
  if (livRows.length === 0) return null;

  const livraison = livRows[0];

  const { rows: catRows } = await pool.query(
    `SELECT
       COALESCE(p.category, 'Sans catégorie') AS category,
       SUM(li.qte_chargee) AS stock,
       SUM(li.qte_vendue) AS sold,
       SUM(li.qte_vendue * li.prix_ttc) AS ca,
       COUNT(*) AS product_count
     FROM livraison_items li
     JOIN products p ON li.product_id = p.id
     WHERE li.livraison_id = $1
     GROUP BY p.category
     ORDER BY p.category`,
    [id]
  );

  const categories = catRows.map(row => ({
    name: String(row.category),
    stock: Number(row.stock),
    sold: Number(row.sold),
    remaining: Number(row.stock) - Number(row.sold),
    ca: Number(Number(row.ca).toFixed(3)),
    sell_through_pct: row.stock > 0
      ? Math.round((Number(row.sold) / Number(row.stock)) * 100)
      : 0,
    product_count: Number(row.product_count),
  }));

  const total_stock = categories.reduce((s, c) => s + c.stock, 0);
  const total_sold = categories.reduce((s, c) => s + c.sold, 0);
  const total_ca = Number(categories.reduce((s, c) => s + c.ca, 0).toFixed(3));
  const total_remaining = total_stock - total_sold;
  const sell_through_pct = total_stock > 0
    ? Math.round((total_sold / total_stock) * 100)
    : 0;

  return {
    livraison: { reference: livraison.reference, status: livraison.status },
    overall: {
      total_stock,
      total_sold,
      total_remaining,
      total_ca,
      sell_through_pct,
    },
    categories,
  };
}

// ============================================================
// END LIVRAISON & BON DE RETOUR
// ============================================================

/**
 * Terminate livraison — ATOMIC TRANSACTION
 */
async function terminerLivraison(id, commercial_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: livRows } = await client.query(
      'SELECT * FROM livraisons WHERE id = $1 FOR UPDATE', [id]
    );
    if (livRows.length === 0) { await client.query('ROLLBACK'); return { error: 'Livraison introuvable.' }; }
    if (livRows[0].status !== 'EN_COURS') { await client.query('ROLLBACK'); return { error: `Impossible de terminer. Statut: ${livRows[0].status}.` }; }
    if (livRows[0].commercial_id !== commercial_id) { await client.query('ROLLBACK'); return { error: 'Cette livraison ne vous est pas assignée.' }; }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE livraisons SET status = 'EN_RETOUR', end_declared_at = $2 WHERE id = $1`,
      [id, now]
    );

    await client.query('COMMIT');

    // Return full summary
    const livraison = await findById(id);
    const ca_total = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
    const commission = Number((ca_total * COMMISSION_RATE).toFixed(3));
    const net_a_reverser = Number((ca_total - commission).toFixed(3));

    return { livraison, ca_total: Number(ca_total.toFixed(3)), commission, net_a_reverser };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Confirm Bon de Retour — Dual confirmation.
 * If both confirmed: ATOMIC re-add stock + CLOTURE.
 */
async function confirmerRetour(id, user_id, role) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: livRows } = await client.query(
      'SELECT * FROM livraisons WHERE id = $1 FOR UPDATE', [id]
    );
    if (livRows.length === 0) { await client.query('ROLLBACK'); return { error: 'Livraison introuvable.' }; }
    if (livRows[0].status !== 'EN_RETOUR') { await client.query('ROLLBACK'); return { error: `Statut invalide: ${livRows[0].status}. Attendu: EN_RETOUR.` }; }

    const now = new Date().toISOString();
    let bothConfirmed = false;

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      if (livRows[0].retour_confirmed_by_admin_at) { await client.query('ROLLBACK'); return { error: 'Vous avez déjà confirmé ce bon de retour.' }; }
      await client.query('UPDATE livraisons SET retour_confirmed_by_admin_at = $2 WHERE id = $1', [id, now]);
    } else if (role === 'COMMERCIAL') {
      if (livRows[0].retour_confirmed_by_commercial_at) { await client.query('ROLLBACK'); return { error: 'Vous avez déjà confirmé ce bon de retour.' }; }
      if (livRows[0].commercial_id !== user_id) { await client.query('ROLLBACK'); return { error: 'Cette livraison ne vous est pas assignée.' }; }
      await client.query('UPDATE livraisons SET retour_confirmed_by_commercial_at = $2 WHERE id = $1', [id, now]);
    }

    // Check if both confirmed
    const { rows: updated } = await client.query('SELECT * FROM livraisons WHERE id = $1', [id]);
    const l = updated[0];

    if (l.retour_confirmed_by_admin_at && l.retour_confirmed_by_commercial_at) {
      // Both confirmed — CLOTURE: re-add stock
      const { rows: items } = await client.query('SELECT * FROM livraison_items WHERE livraison_id = $1', [id]);

      for (const item of items) {
        const qte_retour = item.qte_chargee - item.qte_vendue;
        if (qte_retour > 0) {
          await client.query(
            `INSERT INTO depot_stock (product_id, quantity)
             VALUES ($1, $2)
             ON CONFLICT (product_id)
             DO UPDATE SET quantity = depot_stock.quantity + $2, last_updated = NOW()`,
            [item.product_id, qte_retour]
          );
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, livraison_id, created_by)
             VALUES ($1, 'RETOUR', $2, $3, $4)`,
            [item.product_id, qte_retour, id, user_id]
          );
        }
      }

      await client.query(
        `UPDATE livraisons SET status = 'CLOTURE', closed_at = $2 WHERE id = $1`,
        [id, now]
      );
      bothConfirmed = true;
    }

    await client.query('COMMIT');

    const livraison = await findById(id);
    const ca_total = livraison.items.reduce((sum, i) => sum + i.qte_vendue * Number(i.prix_ttc), 0);
    const commission = Number((ca_total * COMMISSION_RATE).toFixed(3));
    const net_a_reverser = Number((ca_total - commission).toFixed(3));

    return {
      livraison,
      bothConfirmed,
      ca_total: Number(ca_total.toFixed(3)),
      commission,
      net_a_reverser,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Archive a livraison (soft-delete) — SUPER_ADMIN only with password
 */
async function archiveLivraison(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Only archive terminal-state livraisons to prevent stock loss
    const { rows } = await client.query(
      `UPDATE livraisons SET is_archived = true
       WHERE id = $1 AND is_archived = false
         AND status IN ('CLOTURE', 'ANNULE')
       RETURNING id, reference`,
      [id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Commercial requests annulation — status EN_COURS → EN_ATTENTE_ANNULATION
 */
async function demanderAnnulation(id, commercial_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM livraisons WHERE id = $1 FOR UPDATE', [id]
    );
    if (rows.length === 0) { await client.query('ROLLBACK'); return { error: 'Livraison introuvable.' }; }
    if (rows[0].status !== 'EN_COURS') { await client.query('ROLLBACK'); return { error: `Impossible d''annuler. Statut actuel: ${rows[0].status}.` }; }
    if (rows[0].commercial_id !== commercial_id) { await client.query('ROLLBACK'); return { error: 'Cette livraison ne vous est pas assignée.' }; }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE livraisons SET status = 'EN_ATTENTE_ANNULATION', annulation_requested_at = $2 WHERE id = $1`,
      [id, now]
    );

    await client.query('COMMIT');
    const livraison = await findById(id);
    return { livraison };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin confirms annulation — ATOMIC: restore stock → status ANNULE
 */
async function confirmerAnnulation(id, admin_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM livraisons WHERE id = $1 FOR UPDATE', [id]
    );
    if (rows.length === 0) { await client.query('ROLLBACK'); return { error: 'Livraison introuvable.' }; }
    if (rows[0].status !== 'EN_ATTENTE_ANNULATION') { await client.query('ROLLBACK'); return { error: `Statut invalide: ${rows[0].status}. Attendu: EN_ATTENTE_ANNULATION.` }; }

    // Restore stock: re-add all charged quantities
    const { rows: items } = await client.query(
      'SELECT * FROM livraison_items WHERE livraison_id = $1', [id]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO depot_stock (product_id, quantity)
         VALUES ($1, $2)
         ON CONFLICT (product_id)
         DO UPDATE SET quantity = depot_stock.quantity + $2, last_updated = NOW()`,
        [item.product_id, item.qte_chargee]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, livraison_id, created_by)
         VALUES ($1, 'RETOUR', $2, $3, $4)`,
        [item.product_id, item.qte_chargee, id, admin_id]
      );
    }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE livraisons SET status = 'ANNULE', annulation_confirmed_by_admin_at = $2, closed_at = $2 WHERE id = $1`,
      [id, now]
    );

    await client.query('COMMIT');
    const livraison = await findById(id);
    return { livraison };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  COMMISSION_RATE,
  generateReference,
  create,
  findById,
  findAll,
  confirmSortie,
  getSalesState,
  recordSales,
  syncSales,
  getRealtimeData,
  terminerLivraison,
  confirmerRetour,
  archiveLivraison,
  demanderAnnulation,
  confirmerAnnulation,
};
