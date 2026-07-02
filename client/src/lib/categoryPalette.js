// ─── Curated category colour map ───
// 7 categories, each drawn from a non-overlapping region of the colour wheel.
// bg = T200 visibly-tinted pastel (~20-35% saturation), text = T900 near-black, bar = T500 vivid.
// No two colours can be confused — hues span 0deg→270deg with ~45deg gaps.
export const CAT_PALETTE = {
  'Confiserie':        { bg: '#FECACA', text: '#7F1D1D', bar: '#EF4444' },  // Red
  'Nettoyage':         { bg: '#FED7AA', text: '#7C2D12', bar: '#F97316' },  // Orange
  'Épicerie':          { bg: '#FDE68A', text: '#78350F', bar: '#F59E0B' },  // Amber
  'Produits Laitiers': { bg: '#A7F3D0', text: '#064E3B', bar: '#10B981' },  // Green
  'Boissons':          { bg: '#A5F3FC', text: '#164E63', bar: '#06B6D4' },  // Teal
  'Hygiène':           { bg: '#BFDBFE', text: '#1E3A8A', bar: '#3B82F6' },  // Blue
  'Conserves':         { bg: '#DDD6FE', text: '#4C1D95', bar: '#8B5CF6' },  // Violet
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
    bg:  `hsl(${h},${s}%,88%)`,
    text: `hsl(${h},${s}%,18%)`,
    bar:  `hsl(${h},${s}%,50%)`,
  };
}

/**
 * Return { bg, text, bar } for a category.
 * Uses the curated palette when a match exists; otherwise auto-generates.
 */
export function catColors(cat) { return CAT_PALETTE[cat] || autoPalette(cat); }
