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
// 12 hues × 3 saturation levels = 36 unique colours — virtually collision-free

const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const SATS = [50, 62, 74];
const PALETTE_SIZE = HUES.length * SATS.length; // 36

function autoPalette(cat) {
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % PALETTE_SIZE;
  const h = HUES[Math.floor(idx / SATS.length)];
  const s = SATS[idx % SATS.length];
  return {
    bg:  `hsla(${h},${s}%,54%,.1)`,
    text: `hsl(${h},${s}%,34%)`,
    bar:  `hsl(${h},${s}%,48%)`,
  };
}

/**
 * Return { bg, text, bar } for a category.
 * Uses the curated palette when a match exists; otherwise auto-generates.
 */
export function catColors(cat) { return CAT_PALETTE[cat] || autoPalette(cat); }
