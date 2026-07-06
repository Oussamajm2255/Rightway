const { validationResult } = require('express-validator');
const prelevementModel = require('../models/prelevement');
const { verifyPassword } = require('../utils/password');
const pool = require('../db/pool');

// ═══════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════

async function listCategories(_req, res) {
  try {
    let tree = await prelevementModel.getCategoryTree();

    // Auto-seed 6 preset categories if table is empty (self-healing)
    if (tree.length === 0) {
      const { seedPrelevementCategories } = require('../db/migrate');
      await seedPrelevementCategories();
      tree = await prelevementModel.getCategoryTree();
    }

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

async function generateSalaries(req, res) {
  try {
    const { rows: users } = await pool.query(`
      SELECT id, full_name, salary_amount 
      FROM users 
      WHERE is_active = true 
        AND role = 'COMMERCIAL'
        AND remuneration_type = 'SALAIRE' 
        AND salary_amount > 0
    `);

    if (users.length === 0) {
      return res.status(400).json({ error: 'Aucun utilisateur avec un salaire valide trouvé.' });
    }

    let categoryId;
    const { rows: catRows } = await pool.query(`
      SELECT id FROM prelevement_categories WHERE name = 'Charges du personnel' LIMIT 1
    `);
    
    if (catRows.length > 0) {
      categoryId = catRows[0].id;
    } else {
      const { rows: newCatRows } = await pool.query(`
        INSERT INTO prelevement_categories (name) VALUES ('Charges du personnel') RETURNING id
      `);
      categoryId = newCatRows[0].id;
    }

    const monthStr = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    let createdCount = 0;

    for (const u of users) {
      // Check if a salary for this user and month already exists to avoid duplicates
      const { rows: existingRows } = await pool.query(`
        SELECT id FROM prelevements 
        WHERE declared_by = $1 
          AND category_id = $2 
          AND description ILIKE $3
          AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', CURRENT_DATE)
      `, [req.user.id, categoryId, `%Salaire%${monthStr}%`]);

      if (existingRows.length > 0) continue;

      await prelevementModel.createPrelevement({
        category_id: categoryId,
        amount: u.salary_amount,
        description: `Salaire ${monthStr} - ${u.full_name}`,
        reference: `SAL-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}-${u.id.split('-')[0]}`,
        expense_date: new Date().toISOString().split('T')[0],
        declared_by: req.user.id,
        status: 'EN_ATTENTE'
      });
      createdCount++;
    }

    res.json({ message: `${createdCount} proposition(s) de salaire générée(s) avec succès.`, count: createdCount });
  } catch (err) {
    console.error('generateSalaries error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function updatePrelevementStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['VALIDE', 'REJETE'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const existing = await prelevementModel.findPrelevementById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Prélèvement introuvable.' });
    }
    
    if (existing.status !== 'EN_ATTENTE') {
      return res.status(400).json({ error: 'Ce prélèvement n\'est pas en attente.' });
    }

    await prelevementModel.updatePrelevement(id, { status });
    const updated = await prelevementModel.findPrelevementById(id);
    res.json({ message: 'Statut mis à jour.', prelevement: updated });
  } catch (err) {
    console.error('updatePrelevementStatus error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ═══════════════════════════════════════════════
// RECURRING EXPENSES
// ═══════════════════════════════════════════════

async function listRecurringPrelevements(_req, res) {
  try {
    const data = await prelevementModel.findAllRecurringPrelevements();
    res.json({ recurring: data });
  } catch (err) {
    console.error('listRecurringPrelevements error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

const RECURRING_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'YEARLY'];

// Validates the cycle-specific fields for a given frequency.
// MONTHLY/YEARLY reuse generation_day (1-28) as "day of month" —
// capped at 28 so the schedule never skips a month on short Februaries.
function validateCycleFields(frequency, { generation_day, generation_weekday, generation_month }) {
  if (!RECURRING_FREQUENCIES.includes(frequency)) {
    return 'Cycle invalide. Choisissez Hebdomadaire, Mensuel ou Annuel.';
  }
  if (frequency === 'WEEKLY') {
    const wd = parseInt(generation_weekday, 10);
    if (!wd || wd < 1 || wd > 7) {
      return 'Le jour de la semaine est requis pour un cycle hebdomadaire.';
    }
  } else if (frequency === 'MONTHLY') {
    const day = parseInt(generation_day, 10);
    if (!day || day < 1 || day > 28) {
      return 'Le jour du mois (1-28) est requis pour un cycle mensuel.';
    }
  } else if (frequency === 'YEARLY') {
    const month = parseInt(generation_month, 10);
    const day = parseInt(generation_day, 10);
    if (!month || month < 1 || month > 12) {
      return 'Le mois est requis pour un cycle annuel.';
    }
    if (!day || day < 1 || day > 28) {
      return 'Le jour du mois (1-28) est requis pour un cycle annuel.';
    }
  }
  return null;
}

async function createRecurringPrelevement(req, res) {
  try {
    const { category_id, amount, description, is_active } = req.body;
    const frequency = req.body.frequency || 'MONTHLY';

    if (!category_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Catégorie et montant valides requis.' });
    }

    const cycleError = validateCycleFields(frequency, req.body);
    if (cycleError) return res.status(400).json({ error: cycleError });

    const cat = await prelevementModel.getCategoryById(category_id);
    if (!cat) {
      return res.status(400).json({ error: 'Catégorie introuvable.' });
    }

    const created = await prelevementModel.createRecurringPrelevement({
      category_id,
      amount,
      description,
      is_active,
      created_by: req.user.id,
      frequency,
      generation_day: frequency !== 'WEEKLY' ? parseInt(req.body.generation_day, 10) : null,
      generation_weekday: frequency === 'WEEKLY' ? parseInt(req.body.generation_weekday, 10) : null,
      generation_month: frequency === 'YEARLY' ? parseInt(req.body.generation_month, 10) : null,
    });

    res.status(201).json({ recurring: created });
  } catch (err) {
    console.error('createRecurringPrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function updateRecurringPrelevement(req, res) {
  try {
    const { id } = req.params;
    const existing = await prelevementModel.findRecurringPrelevementById(id);
    if (!existing) return res.status(404).json({ error: 'Charge fixe introuvable.' });

    const { category_id, amount, description, is_active } = req.body;

    if (category_id) {
      const cat = await prelevementModel.getCategoryById(category_id);
      if (!cat) return res.status(400).json({ error: 'Catégorie introuvable.' });
    }
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'Le montant doit être supérieur à 0.' });
    }

    const fields = {};
    if (category_id !== undefined) fields.category_id = category_id;
    if (amount !== undefined) fields.amount = amount;
    if (description !== undefined) fields.description = description;
    if (is_active !== undefined) fields.is_active = is_active;

    // Cycle fields are validated together (frequency + its matching day/weekday/month),
    // falling back to the existing row's values for anything not sent in this request.
    const touchesCycle = ['frequency', 'generation_day', 'generation_weekday', 'generation_month']
      .some((key) => req.body[key] !== undefined);

    if (touchesCycle) {
      const frequency = req.body.frequency !== undefined ? req.body.frequency : existing.frequency;
      const merged = {
        generation_day: req.body.generation_day !== undefined ? req.body.generation_day : existing.generation_day,
        generation_weekday: req.body.generation_weekday !== undefined ? req.body.generation_weekday : existing.generation_weekday,
        generation_month: req.body.generation_month !== undefined ? req.body.generation_month : existing.generation_month,
      };
      const cycleError = validateCycleFields(frequency, merged);
      if (cycleError) return res.status(400).json({ error: cycleError });

      fields.frequency = frequency;
      fields.generation_day = frequency !== 'WEEKLY' ? parseInt(merged.generation_day, 10) : null;
      fields.generation_weekday = frequency === 'WEEKLY' ? parseInt(merged.generation_weekday, 10) : null;
      fields.generation_month = frequency === 'YEARLY' ? parseInt(merged.generation_month, 10) : null;
    }

    await prelevementModel.updateRecurringPrelevement(id, fields);
    const updated = await prelevementModel.findRecurringPrelevementById(id);
    res.json({ recurring: updated });
  } catch (err) {
    console.error('updateRecurringPrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function deleteRecurringPrelevement(req, res) {
  try {
    const { id } = req.params;
    await prelevementModel.deleteRecurringPrelevement(id);
    res.json({ message: 'Modèle de prélèvement récurrent supprimé.' });
  } catch (err) {
    console.error('deleteRecurringPrelevement error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function generateRecurring(req, res) {
  try {
    const activeRecurring = await pool.query(`
      SELECT * FROM recurring_prelevements WHERE is_active = true
    `);
    
    if (activeRecurring.rows.length === 0) {
      return res.status(400).json({ error: 'Aucune charge fixe active trouvée.' });
    }

    const monthStr = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    let createdCount = 0;

    for (const r of activeRecurring.rows) {
      // Avoid duplicate for the current month based on same recurring entry logic
      // Note: We use reference starting with 'REC-{id}'
      const refPrefix = `REC-${r.id}-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}`;
      
      const { rows: existingRows } = await pool.query(`
        SELECT id FROM prelevements 
        WHERE reference = $1
      `, [refPrefix]);

      if (existingRows.length > 0) continue;

      await prelevementModel.createPrelevement({
        category_id: r.category_id,
        amount: r.amount,
        description: r.description ? `${r.description} - ${monthStr}` : `Charge fixe - ${monthStr}`,
        reference: refPrefix,
        expense_date: new Date().toISOString().split('T')[0],
        declared_by: req.user.id,
        status: 'EN_ATTENTE'
      });
      createdCount++;
    }

    res.json({ message: `${createdCount} charge(s) fixe(s) générée(s) avec succès.`, count: createdCount });
  } catch (err) {
    console.error('generateRecurring error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

// ═══════════════════════════════════════════════
// GLOBAL SETTINGS (Salary generation day)
// ═══════════════════════════════════════════════
async function getSettings(req, res) {
  try {
    const { rows } = await pool.query('SELECT salary_generation_day FROM global_settings WHERE id = 1');
    if (rows.length === 0) {
      return res.json({ settings: { salary_generation_day: 1 } });
    }
    res.json({ settings: rows[0] });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

async function updateSettings(req, res) {
  try {
    const { salary_generation_day } = req.body;
    if (salary_generation_day < 1 || salary_generation_day > 28) {
      return res.status(400).json({ error: 'Le jour doit être compris entre 1 et 28.' });
    }
    const { rows } = await pool.query(`
      INSERT INTO global_settings (id, salary_generation_day) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET salary_generation_day = $1, updated_at = NOW()
      RETURNING salary_generation_day
    `, [salary_generation_day]);
    res.json({ settings: rows[0] });
  } catch (err) {
    console.error('updateSettings error:', err);
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
  generateSalaries,
  updatePrelevementStatus,
  listRecurringPrelevements,
  createRecurringPrelevement,
  updateRecurringPrelevement,
  deleteRecurringPrelevement,
  generateRecurring,
  getSettings,
  updateSettings,
};
