/**
 * Haptics utility for Android Capacitor APK.
 *
 * Uses `navigator.vibrate` (available in Android WebView since Chrome 32).
 * Respects `prefers-reduced-motion: reduce` — all calls are no-ops when the
 * user has requested reduced motion.
 *
 * Usage:
 *   import haptics from '../lib/haptics';
 *   haptics.tap();        // button press, bottom-nav tap (10 ms)
 *   haptics.selection();  // toggle switch, dropdown change (5 ms)
 *   haptics.success();    // form submission, action confirmation (15+10 ms double-tap)
 *
 * All methods are fire-and-forget — they never throw.
 */

const HAPTICS_ENABLED = (() => {
  if (typeof navigator === 'undefined') return false;
  if (!('vibrate' in navigator)) return false;
  // Check reduced-motion preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  }
  return true;
})();

function vibrate(pattern) {
  if (!HAPTICS_ENABLED) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Silently ignore — WebView may deny vibration in some contexts.
  }
}

const haptics = {
  /** Light tap — navigation taps, button presses. */
  tap() {
    vibrate(10);
  },

  /** Selection change — toggles, dropdown changes, switch flips. */
  selection() {
    vibrate(5);
  },

  /** Success confirmation — form submission, save, delete confirm. */
  success() {
    vibrate([15, 30, 10]);
  },
};

export default haptics;
