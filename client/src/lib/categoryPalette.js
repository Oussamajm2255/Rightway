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

/** Hash a string to a stable hue 0–360 so every category gets a distinct colour. */
function hashHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

function autoPalette(cat) {
  const h = hashHue(cat);
  return {
    bg:  `hsla(${h},58%,54%,.1)`,
    text: `hsl(${h},58%,34%)`,
    bar:  `hsl(${h},58%,45%)`,
  };
}

/**
 * Return { bg, text, bar } for a category.
 * Uses the curated palette when a match exists; otherwise auto-generates.
 */
export function catColors(cat) { return CAT_PALETTE[cat] || autoPalette(cat); }
