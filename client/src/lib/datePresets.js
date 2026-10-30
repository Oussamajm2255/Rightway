// ─── Date range presets (local time, YYYY-MM-DD) ───
function toYMD(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// Returns { from, to } for a preset key. Empty strings = no bound (all time).
export function presetRange(key) {
  const now = new Date();
  const today = toYMD(now);
  const y = now.getFullYear(), m = now.getMonth();
  switch (key) {
    case 'month':      return { from: toYMD(new Date(y, m, 1)), to: today };
    case 'last_month': return { from: toYMD(new Date(y, m - 1, 1)), to: toYMD(new Date(y, m, 0)) };
    case '3months':    return { from: toYMD(new Date(y, m - 2, 1)), to: today };
    case 'year':       return { from: toYMD(new Date(y, 0, 1)), to: today };
    case 'all':
    default:           return { from: '', to: '' };
  }
}

export const DATE_PRESETS = [
  { key: 'month', label: 'Ce mois' },
  { key: 'last_month', label: 'Mois dernier' },
  { key: '3months', label: '3 derniers mois' },
  { key: 'year', label: 'Cette année' },
  { key: 'all', label: 'Tout' },
];

// Directeur Commercial: one quarter at most
export const QUARTER_PRESETS = DATE_PRESETS.filter((p) => ['month', 'last_month', '3months'].includes(p.key));

// Earliest start date for a period ending on `to` (today when empty)
export function quarterStart(to) {
  const d = to ? new Date(to) : new Date();
  d.setMonth(d.getMonth() - 3);
  return toYMD(d);
}

// Latest end date for a period starting on `from`
export function quarterEnd(from) {
  if (!from) return undefined;
  const d = new Date(from);
  d.setMonth(d.getMonth() + 3);
  return toYMD(d);
}
