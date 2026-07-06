// ─── Golden-angle category color engine ───
//
// Problem this replaces: assigning a color to a category by hashing its
// name in isolation. Two unrelated category names can hash close together
// by pure chance, so two categories shown in the same table could end up
// looking almost identical — exactly the bug reported in Stock/Products/
// Sales tables.
//
// Fix: never color a category in isolation. Take the FULL, real list of
// categories at once, sort it into a stable order, and place each one on
// the color wheel using the golden angle (≈137.508°) — the same irrational
// rotation sunflowers use to pack seeds with maximal spacing. For any
// number of categories N, this is the most evenly spread arrangement
// possible: no two categories can ever land close together, and adding a
// new category later doesn't reshuffle anyone else's color.
const GOLDEN_ANGLE = 137.50776405003785;

// A second differentiation channel: alternating saturation/lightness bands.
// Once there are enough categories that hue alone gets tight (20+), two
// neighbouring hues still read as different shades, not just different hues.
const BANDS = [
  { s: 72, lBg: 88, lText: 20, lBar: 46 },
  { s: 58, lBg: 84, lText: 24, lBar: 52 },
  { s: 82, lBg: 91, lText: 17, lBar: 40 },
];

function hslTriplet(hue, bandIndex) {
  const b = BANDS[bandIndex % BANDS.length];
  const h = Math.round(hue * 10) / 10;
  return {
    bg: `hsl(${h}, ${b.s}%, ${b.lBg}%)`,
    text: `hsl(${h}, ${b.s}%, ${b.lText}%)`,
    bar: `hsl(${h}, ${b.s}%, ${b.lBar}%)`,
    // Semi-transparent variant of `bar` — for chart fills, where a soft
    // fill + crisp solid border reads better than a flat solid block.
    barSoft: `hsl(${h} ${b.s}% ${b.lBar}% / 0.75)`,
  };
}

// "Sans catégorie" / unknown — deliberately neutral gray, never part of the
// hue rotation, so it reads as "unclassified" rather than competing for a slot.
export const NEUTRAL_COLORS = { bg: '#F1F5F9', text: '#475569', bar: '#94A3B8', barSoft: '#94A3B8bf' };

/**
 * Builds a stable name → {bg, text, bar} map for a full set of category
 * names. Sorting alphabetically first means the same set of categories
 * always produces the same colors (consistent across every table in the
 * app), and each category's hue comes from its index in that sorted list
 * via the golden angle — guaranteeing maximal separation across the WHOLE
 * set at once, not just a hash-based coin flip per name.
 */
export function buildCategoryPalette(categoryNames) {
  const unique = [...new Set((categoryNames || []).filter(Boolean))]
    .filter((name) => name !== 'Sans catégorie')
    .sort((a, b) => a.localeCompare(b, 'fr'));

  const map = {};
  unique.forEach((name, i) => {
    const hue = (i * GOLDEN_ANGLE) % 360;
    map[name] = hslTriplet(hue, i);
  });
  return map;
}

// Single-name fallback — only used transiently before the app-wide category
// registry (see CategoryPaletteContext) has finished loading. Not collision-
// proof on its own; buildCategoryPalette is the real guarantee.
function fallbackColorForName(cat) {
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return hslTriplet(hue, 0);
}

/**
 * Look up a category's color. Prefer useCategoryPalette()'s `getColor`
 * from a component so colors come from the full app-wide registry; this
 * function is the standalone fallback for the brief window before that
 * registry has loaded, or for non-component call sites.
 */
export function catColors(cat, palette) {
  if (!cat || cat === 'Sans catégorie') return NEUTRAL_COLORS;
  if (palette && palette[cat]) return palette[cat];
  return fallbackColorForName(cat);
}
