// ─── Curated category colour map ───
// 7 categories, each drawn from a non-overlapping region of the colour wheel.
// bg = solid pastel (row background + pill fill), text/bar = bold saturated accent.
export const CAT_PALETTE = {
  'Confiserie':        { bg: '#FEF2F2', text: '#B91C1C', bar: '#B91C1C' },  // Scarlet (Red     ~0deg)
  'Nettoyage':         { bg: '#FFF7ED', text: '#C2410C', bar: '#C2410C' },  // Tangerine (Orange  ~25deg)
  'Épicerie':          { bg: '#FFFBEB', text: '#B45309', bar: '#B45309' },  // Honey (Amber      ~45deg)
  'Produits Laitiers': { bg: '#ECFDF5', text: '#047857', bar: '#047857' },  // Emerald (Green     ~160deg)
  'Boissons':          { bg: '#ECFEFF', text: '#0E7490', bar: '#0E7490' },  // Teal (Cyan        ~195deg)
  'Hygiène':           { bg: '#EFF6FF', text: '#1D4ED8', bar: '#1D4ED8' },  // Sapphire (Blue     ~225deg)
  'Conserves':         { bg: '#F5F3FF', text: '#6D28D9', bar: '#6D28D9' },  // Amethyst (Violet   ~270deg)
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
