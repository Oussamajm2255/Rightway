const { validationResult } = require('express-validator');
const userModel = require('../models/user');
const { hashPassword, verifyPassword } = require('../utils/password');

/**
 * GET /api/users
 * Query: ?role=ADMIN&is_active=true&search=smir
 */
async function listUsers(req, res) {
  try {
    const { role, is_active, search } = req.query;
    const users = await userModel.findAll({ role, is_active, search });
    // Remove password_hash from all responses
    res.json({ users });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/users/:id
 */
async function getUser(req, res) {
  try {
    const user = await userModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('getUser error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * POST /api/users
 * Create Admin or Commercial (Super Admin only — enforced by route middleware)
 */
async function createUser(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { full_name, email, password, role, phone, vehicle_name, vehicle_plate, remuneration_type, salary_amount } = req.body;

    // Check email uniqueness
    const existing = await userModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà.' });
    }

    const password_hash = await hashPassword(password);
    
    // Remuneration (commission vs salary) applies to personnel roles —
    // COMMERCIAL, MAGASINIER, and DIRECTEUR_COMMERCIAL.
    const isPersonnel = role === 'COMMERCIAL' || role === 'MAGASINIER' || role === 'DIRECTEUR_COMMERCIAL';
    let resolvedRemuneration = remuneration_type;
    let resolvedSalary = salary_amount;
    if (!isPersonnel) {
      resolvedRemuneration = null;
      resolvedSalary = 0;
    } else {
      resolvedRemuneration = remuneration_type || 'COMMISSION';
      if (resolvedRemuneration === 'COMMISSION') {
        resolvedSalary = 0;
      }
    }

    const user = await userModel.create({
      full_name,
      email,
      password_hash,
      role,
      phone: phone || null,
      vehicle_name: vehicle_name || null,
      vehicle_plate: vehicle_plate || null,
      remuneration_type: resolvedRemuneration,
      salary_amount: resolvedSalary || 0
    });

    res.status(201).json({ user });
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * PUT /api/users/:id
 * Edit user
 */
async function updateUser(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const targetUser = await userModel.findById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    // Prevent modifying SUPER_ADMIN
    if (targetUser.role === 'SUPER_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Vous ne pouvez pas modifier le Super Admin.' });
    }

    // If email is being changed, check uniqueness
    if (req.body.email && req.body.email !== targetUser.email) {
      const existing = await userModel.findByEmail(req.body.email);
      if (existing) {
        return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà.' });
      }
    }

    const fields = {};
    if (req.body.full_name !== undefined) fields.full_name = req.body.full_name;
    if (req.body.email !== undefined) fields.email = req.body.email;
    if (req.body.phone !== undefined) fields.phone = req.body.phone;
    if (req.body.vehicle_name !== undefined) fields.vehicle_name = req.body.vehicle_name;
    if (req.body.vehicle_plate !== undefined) fields.vehicle_plate = req.body.vehicle_plate;
    if (req.body.is_active !== undefined) fields.is_active = req.body.is_active;
    if (req.body.remuneration_type !== undefined) fields.remuneration_type = req.body.remuneration_type;
    
    if (req.body.salary_amount !== undefined) {
      fields.salary_amount = req.body.salary_amount;
    }
    
    // If the user is changed to COMMISSION, force salary_amount to 0
    if (fields.remuneration_type === 'COMMISSION' || (!fields.remuneration_type && targetUser.remuneration_type === 'COMMISSION')) {
      fields.salary_amount = 0;
    }

    const updated = await userModel.update(id, fields);
    res.json({ user: updated });
  } catch (err) {
    console.error('updateUser error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * DELETE /api/users/:id
 * Soft-deactivate with password confirmation
 */
async function deactivateUser(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Votre mot de passe est requis pour désactiver un utilisateur.' });
    }

    // Verify the requesting user's password
    const { rows } = await require('../db/pool').query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    const valid = await verifyPassword(password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe incorrect.' });
    }

    const { id } = req.params;
    const targetUser = await userModel.findById(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Le Super Admin ne peut pas être désactivé.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
    }

    const deactivated = await userModel.deactivate(id);
    res.json({ user: deactivated, message: 'Utilisateur désactivé avec succès.' });
  } catch (err) {
    console.error('deactivateUser error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * GET /api/users/commercials
 * Returns active personnel (COMMERCIAL + DIRECTEUR_COMMERCIAL).
 * Used by: prélèvement commercial dropdown, charges fixes, livraison assignment.
 */
async function listCommercials(req, res) {
  try {
    const users = await userModel.findAll({ roles: ['COMMERCIAL', 'DIRECTEUR_COMMERCIAL'], is_active: true });
    res.json({ users });
  } catch (err) {
    console.error('listCommercials error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, deactivateUser, listCommercials };
