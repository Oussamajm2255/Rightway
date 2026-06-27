const commercialModel = require('../models/commercial');
const { COMMISSION_RATE } = require('../models/livraison');

/**
 * GET /api/commercials
 * Returns all COMMERCIAL users with performance stats + global KPIs.
 */
async function getAllCommercials(req, res) {
  try {
    const [commercials, monthlyCA] = await Promise.all([
      commercialModel.getAllWithStats(),
      commercialModel.getMonthlyCA(),
    ]);

    // Enrich each commercial
    const enriched = commercials.map(c => {
      const ca = Number(c.ca_total);
      const avances = Number(c.avances_total);
      const commission = Number((ca * COMMISSION_RATE).toFixed(3));
      const net = Number((ca - commission - avances).toFixed(3));
      const completion = c.livraisons_total > 0
        ? Math.round((c.livraisons_cloturees / c.livraisons_total) * 100)
        : 0;

      // Derive active status
      let status = 'INACTIVE';
      if (c.livraisons_actives > 0) {
        // Check if any is EN_RETOUR
        status = c.livraisons_en_retour > 0 ? 'EN_RETOUR' : 'EN_COURS';
      }

      // Extract initials
      const nameParts = (c.full_name || '').trim().split(' ');
      const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : (nameParts[0]?.[0] || '?').toUpperCase();

      // Get monthly CA array (last 6 months, current month first going back)
      const caMap = monthlyCA[c.id] || {};
      const monthly = getMonthlyArray(caMap);

      return {
        id: c.id,
        full_name: c.full_name,
        initials,
        vehicle_name: c.vehicle_name || '—',
        vehicle_plate: c.vehicle_plate || '—',
        is_active: c.is_active,
        status,
        livraisons_total: c.livraisons_total,
        livraisons_actives: c.livraisons_actives,
        livraisons_cloturees: c.livraisons_cloturees,
        livraisons_annulees: c.livraisons_annulees,
        livraisons_en_retour: c.livraisons_en_retour,
        ca_total: ca,
        avances_total: avances,
        ecoulement: c.ecoulement,
        commission,
        net_a_reverser: net,
        completion,
        monthly_ca: monthly,
      };
    });

    // Global KPIs
    const activeAgents = enriched.filter(c => c.is_active).length;
    const encours = enriched.filter(c => c.status === 'EN_COURS' || c.status === 'EN_RETOUR').length;
    const caGlobal = enriched.reduce((sum, c) => sum + c.ca_total, 0);
    const commGlobal = Number((caGlobal * COMMISSION_RATE).toFixed(3));
    const completionAvg = enriched.length > 0
      ? Math.round(enriched.reduce((sum, c) => sum + c.completion, 0) / enriched.length)
      : 0;

    res.json({
      globals: {
        agents: activeAgents,
        encours,
        ca_global: Number(caGlobal.toFixed(3)),
        commissions: commGlobal,
        completion_avg: completionAvg,
      },
      commercials: enriched,
    });
  } catch (err) {
    console.error('getAllCommercials error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

/**
 * Build monthly CA array for last 6 months from a {monthNum: ca} map.
 * Returns [jan, fev, mar, avr, mai, jun] aligned to current date.
 */
function getMonthlyArray(caMap) {
  const now = new Date();
  const months = [];
  // Go back 5 months from current month
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthNum = d.getMonth() + 1; // 1-12
    months.push(Number((caMap[monthNum] || 0).toFixed(3)));
  }
  return months;
}

/**
 * GET /api/commercials/history
 * Returns filtered livraison history for historique tab.
 */
async function getHistory(req, res) {
  try {
    const { commercial_id, date_from, date_to, status } = req.query;

    const history = await commercialModel.getHistory({
      commercial_id: commercial_id && commercial_id !== 'all' ? commercial_id : undefined,
      date_from,
      date_to,
      status,
    });

    res.json({ history });
  } catch (err) {
    console.error('getHistory error:', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}

module.exports = { getAllCommercials, getHistory };
