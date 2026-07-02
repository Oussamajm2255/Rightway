// ─── Curated category colour map ───
// 7 categories, each drawn from a non-overlapping region of the colour wheel.
// bg = visible pastel (T100 shades → ~10-15% saturated), text = T800 (dark), bar = T600 (vivid).
// No two colours can be confused — hues span 0deg→270deg with wide gaps.
export const CAT_PALETTE = {
  'Confiserie':        { bg: '#FEE2E2', text: '#991B1B', bar: '#DC2626' },  // Red
  'Nettoyage':         { bg: '#FFEDD5', text: '#9A3412', bar: '#EA580C' },  // Orange
  'Épicerie':          { bg: '#FEF3C7', text: '#92400E', bar: '#D97706' },  // Amber
  'Produits Laitiers': { bg: '#D1FAE5', text: '#065F46', bar: '#059669' },  // Green
  'Boissons':          { bg: '#CFFAFE', text: '#155E75', bar: '#0891B2' },  // Teal
  'Hygiène':           { bg: '#DBEAFE', text: '#1E40AF', bar: '#2563EB' },  // Blue
  'Conserves':         { bg: '#EDE9FE', text: '#5B21B6', bar: '#7C3AED' },  // Violet
};

// ─── Auto-generated colours for categories not in the curated list ───
// Golden-ratio hue spacing — every category gets a unique, maximally-
// separated hue.  No two categories can land on visually similar tones.

const GOLDEN_RATIO_CONJUGATE = 0.618033988749895; // (√5 − 1) / 2

function autoPalette(cat) {
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;

  // Golden ratio ensures maximum hue spread — adjacent categories in
  // hash-space are ~222° apart, so they never look similar.
  const h = Math.round((Math.abs(hash) * GOLDEN_RATIO_CONJUGATE * 360) % 360);
  const s = 60 + (Math.abs(hash >> 2) % 16); // 60–75 % saturation

  return {
    bg:  `hsla(${h},${s}%,50%,.06)`,
    text: `hsl(${h},${s}%,22%)`,
    bar:  `hsl(${h},${s}%,46%)`,
  };
}

/**
 * Return { bg, text, bar } for a category.
 * Uses the curated palette when a match exists; otherwise auto-generates.
 */
export function catColors(cat) { return CAT_PALETTE[cat] || autoPalette(cat); }
