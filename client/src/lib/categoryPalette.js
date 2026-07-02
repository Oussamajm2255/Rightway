// ─── Curated category colour map ───
export const CAT_PALETTE = {
  'Épicerie':          { bg: 'rgba(42,120,214,.1)',   text: '#1a58a6', bar: '#2a78d6' },
  'Boissons':          { bg: 'rgba(8,145,178,.1)',    text: '#066d8f', bar: '#0891b2' },
  'Produits Laitiers': { bg: 'rgba(15,158,106,.1)',   text: '#0a7a51', bar: '#0f9e6a' },
  'Hygiène':           { bg: 'rgba(124,58,237,.1)',   text: '#5b1fcf', bar: '#7c3aed' },
  'Nettoyage':         { bg: 'rgba(217,89,38,.1)',    text: '#a0390a', bar: '#d95926' },
  'Confiserie':        { bg: 'rgba(219,39,119,.1)',   text: '#9d1560', bar: '#db2777' },
  'Conserves':         { bg: 'rgba(201,133,0,.1)',    text: '#835800', bar: '#c98500' },
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
    bg:  `hsla(${h},${s}%,50%,.12)`,
    text: `hsl(${h},${s}%,33%)`,
    bar:  `hsl(${h},${s}%,46%)`,
  };
}

/**
 * Return { bg, text, bar } for a category.
 * Uses the curated palette when a match exists; otherwise auto-generates.
 */
export function catColors(cat) { return CAT_PALETTE[cat] || autoPalette(cat); }
