const { body } = require('express-validator');

const changePasswordRules = [
  body('currentPassword')
    .trim()
    .notEmpty().withMessage('Le mot de passe actuel est requis.'),
  body('newPassword')
    .trim()
    .notEmpty().withMessage('Le nouveau mot de passe est requis.')
    .isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit comporter au moins 8 caractères.'),
];

module.exports = { changePasswordRules };
