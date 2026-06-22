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
 * Body: { product_id, quantity_change, reason, password }
 * quantity_change: positive = add, negative = remove
 */
async function adjustStock(req, res) {
  try {
    const { product_id, quantity_change, reason, password } = req.body;

    if (!product_id || quantity_change === undefined || quantity_change === null) {
      return res.status(400).json({ error: 'Produit et quantité sont requis.' });
    }

    if (!Number.isInteger(quantity_change) || quantity_change === 0) {
      return res.status(400).json({ error: 'La quantité doit être un entier non nul.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Un motif d\'ajustement est requis.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Votre mot de passe est requis pour confirmer l\'ajustement.' });
    }

    // Verify password
    const { rows: userRows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }

    const valid = await verifyPassword(password, userRows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    // Check product exists
    const { rows: productRows } = await pool.query(
      'SELECT id, name FROM products WHERE id = $1',
      [product_id]
    );
    if (productRows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }

    const result = await stockModel.adjustStock(product_id, quantity_change, reason, req.user.id);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      stock: result.stock,
      message: `Stock de "${productRows[0].name}" ajusté de ${quantity_change > 0 ? '+' : ''}${quantity_change} unités.`,
    });
  } catch (err) {
    console.error('adjustStock error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { listStock, getAlerts, adjustStock };
