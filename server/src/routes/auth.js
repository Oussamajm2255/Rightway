const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, me, refresh } = require('../controllers/auth');
const { authenticate } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);
router.post('/refresh', refresh);

module.exports = router;
