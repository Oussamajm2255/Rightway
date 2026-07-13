const stockModel = require('../models/stock');
const { verifyPassword } = require('../utils/password');
const pool = require('../db/pool');

/**
 * GET /api/stock
 * Query: ?category=Biscuits
 */
async function listStock(req, res) {
  try {
    const { category } = req.query;
    const stock = await stockModel.getStockLevels({ category });
    res.json({ stock });
  } catch (err) {
    console.error('listStock error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/stock/alerts
 * Query: ?threshold=20 (default 20)
 */
async function getAlerts(req, res) {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 20;
    const alerts = await stockModel.getStockAlerts(threshold);
    res.json({ alerts, threshold });
  } catch (err) {
    console.error('getAlerts error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * PUT /api/stock/adjust
 * Single: { product_id, quantity_change, reason, password, movement_date?, invoice_number?, company_name? }
 * Batch:  { items: [{product_id, quantity_change}], reason, password, movement_date?, invoice_number?, company_name? }
 * quantity_change: positive = add, negative = remove
 */
async function adjustStock(req, res) {
  try {
    const { product_id, quantity_change, items, reason, password, movement_date, invoice_number, company_name } = req.body;

    // Determine if batch or single
    const isBatch = Array.isArray(items) && items.length > 0;

    if (!isBatch && (!product_id || quantity_change === undefined || quantity_change === null)) {
      return res.status(400).json({ error: 'Produit et quantité sont requis.' });
    }

    if (isBatch) {
      // Validate each item
      for (const item of items) {
        if (!item.product_id) return res.status(400).json({ error: 'Chaque ligne doit avoir un produit.' });
        if (!Number.isInteger(item.quantity_change) || item.quantity_change === 0) {
          return res.status(400).json({ error: `Quantité invalide pour le produit ${item.product_id}.` });
        }
      }
      // Check for duplicate products
      const ids = items.map(i => i.product_id);
      if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: 'Produits en double dans la même opération.' });
      }
    } else {
      if (!Number.isInteger(quantity_change) || quantity_change === 0) {
        return res.status(400).json({ error: 'La quantité doit être un entier non nul.' });
      }
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Un motif d\'ajustement est requis.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Votre mot de passe est requis pour confirmer l\'ajustement.' });
    }

    // Validate movement_date if provided
    if (movement_date) {
      const d = new Date(movement_date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Date de mouvement invalide.' });
      }
    }

    // Verify password once
    const { rows: userRows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    const valid = await verifyPassword(password, userRows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Mot de passe incorrect.' });
    }

    const extraFields = {};
    if (movement_date) extraFields.movement_date = movement_date;
    if (invoice_number) extraFields.invoice_number = invoice_number;
    if (company_name) extraFields.company_name = company_name;

    if (isBatch) {
      // Batch adjustment
      const results = [];
      for (const item of items) {
        // Check product exists
        const { rows: productRows } = await pool.query(
          'SELECT id, name FROM products WHERE id = $1',
          [item.product_id]
        );
        if (productRows.length === 0) {
          return res.status(404).json({ error: `Produit ${item.product_id} introuvable.` });
        }

        const result = await stockModel.adjustStock(item.product_id, item.quantity_change, reason, req.user.id, extraFields);
        if (result.error) {
          return res.status(400).json({ error: result.error });
        }
        results.push({ product_name: productRows[0].name, quantity_change: item.quantity_change });
      }

      const totalUnits = results.reduce((sum, r) => sum + Math.abs(r.quantity_change), 0);
      res.json({
        message: `${results.length} produit(s) ajusté(s) pour un total de ${totalUnits} unités.`,
        results,
      });
    } else {
      // Single adjustment (existing flow)
      const { rows: productRows } = await pool.query(
        'SELECT id, name FROM products WHERE id = $1',
        [product_id]
      );
      if (productRows.length === 0) {
        return res.status(404).json({ error: 'Produit introuvable.' });
      }

      const result = await stockModel.adjustStock(product_id, quantity_change, reason, req.user.id, extraFields);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        stock: result.stock,
        message: `Stock de "${productRows[0].name}" ajusté de ${quantity_change > 0 ? '+' : ''}${quantity_change} unités.`,
      });
    }
  } catch (err) {
    console.error('adjustStock error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/stock/movements
 * Returns ONLY manual adjustments by default (type=AJUSTEMENT).
 * Delivery movements (SORTIE/RETOUR) are tracked per-livraison.
 * Query: ?product_id=XX&date_from=2026-01-01&date_to=2026-06-30&operation=add&limit=100&offset=0
 */
async function listMovements(req, res) {
  try {
    const { product_id, date_from, date_to, operation, limit, offset } = req.query;
    const movements = await stockModel.getStockMovements({
      product_id: product_id || undefined,
      type: 'AJUSTEMENT',
      date_from: date_from || undefined,
      date_to: date_to || undefined,
      operation: operation || undefined,
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0,
    });
    res.json({ movements });
  } catch (err) {
    console.error('listMovements error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { listStock, getAlerts, adjustStock, listMovements };
