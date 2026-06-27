const { validationResult } = require('express-validator');
const prelevementModel = require('../models/prelevement');
const { verifyPassword } = require('../utils/password');
const pool = require('../db/pool');

// ═══════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════

async function listCategories(_req, res) {
  try {
    const tree = await prelevementModel.getCategoryTree();
    res.json({ categories: tree });
  } catch (err) {
    console.error('listCategories error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function createCategory(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, parent_id } = req.body;

    // Prevent depth > 2 (only main → child allowed)
    if (parent_id) {
      const parent = await prelevementModel.getCategoryById(parent_id);
      if (!parent) {
        return res.status(400).json({ error: 'Catégorie parente introuvable.' });
      }
      if (parent.parent_id) {
        return res.status(400).json({ error: 'Impossible de créer une sous-sous-catégorie. Maximum 2 niveaux.' });
      }
    }

    const category = await prelevementModel.createCategory({ name, parent_id });
    res.status(201).json({ category });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Une catégorie avec ce nom existe déjà à ce niveau.' });
    }
    console.error('createCategory error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function updateCategory(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const existing = await prelevementModel.getCategoryById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Catégorie introuvable.' });
    }

    const updated = await prelevementModel.updateCategory(id, { name: req.body.name });
    res.json({ category: updated });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Une catégorie avec ce nom existe déjà à ce niveau.' });
    }
    console.error('updateCategory error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const existing = await prelevementModel.getCategoryById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Catégorie introuvable.' });
    }

    const result = await prelevementModel.deleteCategory(id);
    res.json({
      message: 'Catégorie supprimée.',
      orphaned_expenses: result.orphanedExpenses,
    });
  } catch (err) {
    console.error('deleteCategory error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ═══════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════

async function listPrelevements(req, res) {
  try {
    const { page, limit, category_id, date_from, date_to, search } = req.query;
    const result = await prelevementModel.findAllPrelevements({
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      category_id: category_id ? parseInt(category_id) : undefined,
      date_from,
      date_to,
      search,
    });
    res.json(result);
  } catch (err) {
    console.error('listPrelevements error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function getPrelevement(req, res) {
  try {
    const prelevement = await prelevementModel.findPrelevementById(req.params.id);
    if (!prelevement) {
      return res.status(404).json({ error: 'Prélèvement introuvable.' });
    }
    res.json({ prelevement });
  } catch (err) {
    console.error('getPrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function createPrelevement(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { category_id, amount, description, reference, expense_date } = req.body;

    // Verify category exists
    const cat = await prelevementModel.getCategoryById(category_id);
    if (!cat) {
      return res.status(400).json({ error: 'Catégorie introuvable.' });
    }

    const prelevement = await prelevementModel.createPrelevement({
      category_id,
      amount,
      description,
      reference,
      expense_date,
      declared_by: req.user.id,
    });

    // Fetch full record with joins
    const full = await prelevementModel.findPrelevementById(prelevement.id);
    res.status(201).json({ prelevement: full });
  } catch (err) {
    console.error('createPrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function updatePrelevement(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const existing = await prelevementModel.findPrelevementById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Prélèvement introuvable.' });
    }

    // If category_id changed, verify new category exists
    if (req.body.category_id) {
      const cat = await prelevementModel.getCategoryById(req.body.category_id);
      if (!cat) {
        return res.status(400).json({ error: 'Catégorie introuvable.' });
      }
    }

    const fields = {};
    if (req.body.category_id !== undefined) fields.category_id = req.body.category_id;
    if (req.body.amount !== undefined) fields.amount = req.body.amount;
    if (req.body.description !== undefined) fields.description = req.body.description;
    if (req.body.reference !== undefined) fields.reference = req.body.reference;
    if (req.body.expense_date !== undefined) fields.expense_date = req.body.expense_date;

    await prelevementModel.updatePrelevement(id, fields);
    const updated = await prelevementModel.findPrelevementById(id);
    res.json({ prelevement: updated });
  } catch (err) {
    console.error('updatePrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function deletePrelevement(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { password } = req.body;

    const existing = await prelevementModel.findPrelevementById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Prélèvement introuvable.' });
    }

    // Password re-verification
    const { rows: [userRow] } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!userRow) {
      return res.status(401).json({ error: 'Utilisateur introuvable.' });
    }
    const valid = await verifyPassword(password, userRow.password_hash);
    if (!valid) {
      return res.status(403).json({ error: 'Mot de passe incorrect.' });
    }

    await prelevementModel.deletePrelevement(id);
    res.json({ message: 'Prélèvement supprimé avec succès.' });
  } catch (err) {
    console.error('deletePrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ═══════════════════════════════════════════════
// STATS / KPI
// ═══════════════════════════════════════════════

async function getStats(_req, res) {
  try {
    const stats = await prelevementModel.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listPrelevements,
  getPrelevement,
  createPrelevement,
  updatePrelevement,
  deletePrelevement,
  getStats,
};
