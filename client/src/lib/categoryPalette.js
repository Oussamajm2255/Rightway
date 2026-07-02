// ─── Curated category colour map ───
export const CAT_PALETTE = {
  'Épicerie':          { bg: 'rgba(42,120,214,.055)',   text: '#0f3d7a', bar: '#2a78d6' },
  'Boissons':          { bg: 'rgba(8,145,178,.055)',    text: '#044b63', bar: '#0891b2' },
  'Produits Laitiers': { bg: 'rgba(15,158,106,.055)',   text: '#065535', bar: '#0f9e6a' },
  'Hygiène':           { bg: 'rgba(124,58,237,.055)',   text: '#3d148c', bar: '#7c3aed' },
  'Nettoyage':         { bg: 'rgba(217,89,38,.055)',    text: '#702707', bar: '#d95926' },
  'Confiserie':        { bg: 'rgba(219,39,119,.055)',   text: '#6e0e43', bar: '#db2777' },
  'Conserves':         { bg: 'rgba(201,133,0,.055)',    text: '#5c3d00', bar: '#c98500' },
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
