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
