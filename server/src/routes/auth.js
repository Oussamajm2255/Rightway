const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, me, refresh, changePassword } = require('../controllers/auth');
const { authenticate } = require('../middleware/auth');
const { changePasswordRules } = require('../validators/password');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de rafraîchissements. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);
router.post('/refresh', refreshLimiter, refresh);
router.put('/password', authenticate, passwordChangeLimiter, changePasswordRules, changePassword);

module.exports = router;
