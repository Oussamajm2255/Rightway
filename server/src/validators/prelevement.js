const { body, param } = require('express-validator');

const createCategoryRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Le nom de la catégorie est requis.')
    .isLength({ min: 2, max: 150 }).withMessage('Le nom doit comporter entre 2 et 150 caractères.')
    .escape(),
  body('parent_id')
    .optional({ nullable: true })
    .isInt({ gt: 0 }).withMessage('parent_id doit être un entier valide.'),
];

const updateCategoryRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Le nom de la catégorie est requis.')
    .isLength({ min: 2, max: 150 }).withMessage('Le nom doit comporter entre 2 et 150 caractères.')
    .escape(),
];

const createPrelevementRules = [
  body('category_id')
    .isInt({ gt: 0 }).withMessage('La catégorie est requise.'),
  body('amount')
    .isFloat({ gt: 0 }).withMessage('Le montant doit être supérieur à 0.')
    .custom((v) => {
      if (!/^\d+(\.\d{1,2})?$/.test(String(v))) {
        throw new Error('Le montant doit avoir au maximum 2 décimales.');
      }
      return true;
    }),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3 }).withMessage('La description doit comporter au moins 3 caractères.')
    .escape(),
  body('reference')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('La référence ne peut pas dépasser 100 caractères.')
    .escape(),
  body('expense_date')
    .notEmpty().withMessage('La date de dépense est requise.')
    .isISO8601().withMessage('Format de date invalide.')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La date ne peut pas être dans le futur.');
      }
      return true;
    }),
];

const updatePrelevementRules = [
  body('category_id')
    .optional()
    .isInt({ gt: 0 }).withMessage('Catégorie invalide.'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 }).withMessage('Le montant doit être supérieur à 0.')
    .custom((v) => {
      if (!/^\d+(\.\d{1,2})?$/.test(String(v))) {
        throw new Error('Le montant doit avoir au maximum 2 décimales.');
      }
      return true;
    }),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3 }).withMessage('La description doit comporter au moins 3 caractères.')
    .escape(),
  body('reference')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 100 }).withMessage('La référence ne peut pas dépasser 100 caractères.')
    .escape(),
  body('expense_date')
    .optional()
    .isISO8601().withMessage('Format de date invalide.')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('La date ne peut pas être dans le futur.');
      }
      return true;
    }),
];

const deletePrelevementRules = [
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis pour supprimer un prélèvement.'),
];

module.exports = {
  createCategoryRules,
  updateCategoryRules,
  createPrelevementRules,
  updatePrelevementRules,
  deletePrelevementRules,
};
