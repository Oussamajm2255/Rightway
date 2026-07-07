const { body } = require('express-validator');

const createUserRules = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Le nom complet est requis.')
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit comporter entre 2 et 100 caractères.'),
  body('email')
    .trim()
    .notEmpty().withMessage('L\'email est requis.')
    .isEmail().withMessage('Format d\'email invalide.')
    .normalizeEmail(),
  body('password')
    .trim()
    .notEmpty().withMessage('Le mot de passe est requis.')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit comporter au moins 8 caractères.'),
  body('role')
    .trim()
    .notEmpty().withMessage('Le rôle est requis.')
    .isIn(['DIRECTEUR_COMMERCIAL', 'MAGASINIER', 'COMMERCIAL']).withMessage('Rôle invalide. Rôles autorisés : DIRECTEUR_COMMERCIAL, MAGASINIER, COMMERCIAL.'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim(),
  body('vehicle_name')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('Le nom du véhicule ne peut pas dépasser 100 caractères.'),
  body('vehicle_plate')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 30 }).withMessage('La plaque ne peut pas dépasser 30 caractères.'),
  body('remuneration_type')
    .optional()
    .trim()
    .isIn(['COMMISSION', 'SALAIRE']).withMessage('Type de rémunération invalide. Autorisé: COMMISSION, SALAIRE.'),
  body('salary_amount')
    .optional({ values: 'falsy' })
    .isNumeric().withMessage('Le montant du salaire doit être un nombre valide.'),
];

const updateUserRules = [
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit comporter entre 2 et 100 caractères.'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Format d\'email invalide.')
    .normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .trim(),
  body('vehicle_name')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('Le nom du véhicule ne peut pas dépasser 100 caractères.'),
  body('vehicle_plate')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 30 }).withMessage('La plaque ne peut pas dépasser 30 caractères.'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('Le champ is_active doit être un booléen.'),
  body('remuneration_type')
    .optional()
    .trim()
    .isIn(['COMMISSION', 'SALAIRE']).withMessage('Type de rémunération invalide. Autorisé: COMMISSION, SALAIRE.'),
  body('salary_amount')
    .optional({ values: 'falsy' })
    .isNumeric().withMessage('Le montant du salaire doit être un nombre valide.'),
];

module.exports = { createUserRules, updateUserRules };
