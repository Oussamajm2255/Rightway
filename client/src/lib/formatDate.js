/**
 * Centralized date formatting utilities.
 * All dates in the app should use these functions for consistent French formatting (dd/MM/yyyy).
 */

/**
 * Format a date string/Date to dd/MM/yyyy
 * @param {string|Date|null} dateStr - ISO date string or Date object
 * @returns {string} Formatted date or '—' if null/undefined
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format a date string/Date to dd/MM/yyyy HH:mm
 * @param {string|Date|null} dateStr - ISO date string or Date object
 * @returns {string} Formatted datetime or '—' if null/undefined
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Get relative time description (e.g., "il y a 5 minutes", "hier à 14:30")
 * @param {string|Date} dateStr - ISO date string or Date object
 * @returns {string} Relative time description
 */
export function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const now = new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
  if (diffHour < 24) return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
  if (diffDay === 1) return `hier à ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diffDay < 7) return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
  return formatDate(dateStr);
}
