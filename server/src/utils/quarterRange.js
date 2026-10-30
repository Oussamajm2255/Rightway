/**
 * DIRECTEUR_COMMERCIAL date filters cover one quarter at most.
 * Returns the French error to send, or null when the period is allowed.
 */
function quarterRangeError(role, date_from, date_to) {
  if (role !== 'DIRECTEUR_COMMERCIAL') return null;

  const from = new Date(String(date_from).slice(0, 10));
  const to = new Date(String(date_to || new Date().toISOString()).slice(0, 10));
  if (!date_from || isNaN(from) || isNaN(to)) {
    return 'Veuillez sélectionner une période (un trimestre maximum).';
  }

  const limit = new Date(to);
  limit.setUTCMonth(limit.getUTCMonth() - 3);
  return from < limit ? 'La période sélectionnée ne peut pas dépasser un trimestre.' : null;
}

module.exports = { quarterRangeError };
