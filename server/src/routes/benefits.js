const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const pool = require('../db/pool');
const {
  getBenefits,
  getSalesStats,
  getReportToken,
  downloadBenefitsReport,
  downloadSalesReport,
  REPORT_TOKEN_SCOPE,
} = require('../controllers/benefits');

router.use(authenticate);

// Reports open in a new tab with a download token, which carries no role: only a
// token minted for reports is accepted here, and the role is read from the database.
function authorizeReport(...roles) {
  const checkRole = authorize(...roles);
  return async (req, res, next) => {
    try {
      if (req.downloadTokenLivraisonId !== undefined) {
        if (req.downloadTokenLivraisonId !== REPORT_TOKEN_SCOPE) {
          return res.status(403).json({ error: 'Token de téléchargement invalide pour ce rapport.' });
        }
        const { rows } = await pool.query('SELECT full_name, role, is_active FROM users WHERE id = $1', [req.user.id]);
        if (rows.length === 0 || !rows[0].is_active) return res.status(403).json({ error: 'Accès refusé.' });
        req.user = { id: req.user.id, full_name: rows[0].full_name, role: rows[0].role };
      }
      checkRole(req, res, next);
    } catch (err) {
      console.error('authorizeReport error:', err);
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  };
}

// GET /api/benefits
router.get('/', authorize('SUPER_ADMIN'), getBenefits);

// GET /api/benefits/sales-stats — sales only, no cost or benefit data
router.get('/sales-stats', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), getSalesStats);

// PDF reports
router.get('/report-token', authorize('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), getReportToken);
router.get('/report/pdf', authorizeReport('SUPER_ADMIN'), downloadBenefitsReport);
router.get('/sales-stats/report/pdf', authorizeReport('SUPER_ADMIN', 'DIRECTEUR_COMMERCIAL'), downloadSalesReport);

module.exports = router;
