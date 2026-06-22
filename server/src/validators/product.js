const { body } = require('express-validator');

const createProductRules = [
  body('barcode')
    .trim()
    .notEmpty().withMessage('Le code-barres est requis.')
    .isLength({ max: 20 }).withMessage('Le code-barres ne peut pas dépasser 20 caractères.'),
  body('name')
    .trim()
    .notEmpty().withMessage('Le nom du produit est requis.')
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit comporter entre 2 et 100 caractères.'),
  body('category')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 50 }).withMessage('La catégorie ne peut pas dépasser 50 caractères.'),
  body('purchase_price')
    .notEmpty().withMessage('Le prix d\'achat est requis.')
    .isFloat({ min: 0.001 }).withMessage('Le prix d\'achat doit être un nombre positif.'),
  body('selling_price_ttc')
    .notEmpty().withMessage('Le prix de vente TTC est requis.')
    .isFloat({ min: 0.001 }).withMessage('Le prix de vente TTC doit être un nombre positif.'),
];

const updateProductRules = [
  body('barcode')
    .optional()
    .trim()
    .isLength({ max: 20 }).withMessage('Le code-barres ne peut pas dépasser 20 caractères.'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit comporter entre 2 et 100 caractères.'),
  body('category')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 50 }).withMessage('La catégorie ne peut pas dépasser 50 caractères.'),
  body('purchase_price')
    .optional()
    .isFloat({ min: 0.001 }).withMessage('Le prix d\'achat doit être un nombre positif.'),
  body('selling_price_ttc')
    .optional()
    .isFloat({ min: 0.001 }).withMessage('Le prix de vente TTC doit être un nombre positif.'),
  body('is_active')
    .optional()
    .isBoolean().withMessage('Le champ is_active doit être un booléen.'),
];

module.exports = { createProductRules, updateProductRules };
