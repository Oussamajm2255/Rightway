/**
 * RightWayLoader — Premium Loading Overlay
 * =================================================================
 * Zero-dependency, handcrafted loading experience for Right Way.
 *
 * Animations conceived as an original "Precision Orbit" system:
 *   • Three concentric orbital rings rotate around the logo at
 *     different speeds, each carrying a luminous particle.
 *   • A central glow breathes beneath the mark.
 *   • Brand wordmark "Right Way" reveals with staggered characters
 *     and an independently animated orange underline.
 *   • Progress is rendered as a kinetic energy beam — a flowing
 *     gradient bar with a glowing leading edge that sweeps in
 *     indeterminate mode or fills on demand.
 *
 * Usage:
 *   RightWayLoader.show();          // open overlay, start indeterminate
 *   RightWayLoader.progress(45);    // set determinate progress 0–100
 *   RightWayLoader.hide();          // complete → success pulse → fade out
 *   RightWayLoader.destroy();       // remove all traces from the DOM
 *
 * Every class is prefixed `rw-loader-` — zero global pollution.
 * Only transform, opacity, and filter are animated (never layout props).
 * Respects prefers-reduced-motion; ARIA attributes included.
 * =================================================================
 */

;(function () {
  'use strict'

  /* ================================================================
     Configuration
     ================================================================ */

  var CONFIG = {
    /** Absolute or relative path to the brand logomark (PNG / SVG). */
    logoPath: '/assets/Brand-logo.png',

    /** Brand name rendered in the wordmark. */
    brandName: 'Right Way',

    /** Tagline displayed below the underline. */
    tagline: 'STEP THE WAY FOR TRADING',

    /** Brand accent colour — used for orbit rings, glow, progress beam. */
    accent: '#ff6b00',

    /** Dark surface colour behind the glass pane. */
    surface: 'rgba(0, 0, 0, 0.88)',

    /** Backdrop blur intensity (px). */
    blur: '24px',

    /** Logo display size in px (the image container). */
    logoSize: 72,

    /** Orbit ring diameters (px), outermost → innermost. */
    orbitSizes: [160, 128, 100],

    /** Full rotation period per ring (seconds). */
    orbitSpeeds: [14, 9, 5.5],

    /** Stagger delay per character in the wordmark (seconds). */
    charStagger: 0.06,

    /** Duration of the hide success-pulse (ms). */
    successPulseMs: 300,

    /** Duration of the hide fade-out (ms). */
    fadeOutMs: 350,

    /** Duration of the show entrance (ms). */
    entranceMs: 500,
  }

  /* ================================================================
     State
     ================================================================ */

  var state = {
    /** Whether the overlay is currently in the DOM. */
    mounted: false,

    /** Whether the overlay is visible (entrance complete). */
    visible: false,

    /** Current progress 0–100, or -1 for indeterminate. */
    progress: -1,

    /** ID of the active rAF loop (non-null when animating). */
    rafId: null,

    /** Timestamp of the last rAF frame. */
    lastFrame: 0,

    /** Whether a hide sequence is in progress (prevents double-hide). */
    hiding: false,

    /** Cached DOM references populated by mount(). */
    el: {},
  }

  /* ================================================================
     CSS — complete design system, injected as a <style> tag
     ================================================================ */

  var CSS = [
    '/* RightWayLoader — Premium Loading Overlay */',
    '',
    ':root {',
    '  --rw-accent: ' + CONFIG.accent + ';',
    '  --rw-surface: ' + CONFIG.surface + ';',
    '  --rw-blur: ' + CONFIG.blur + ';',
    '  --rw-logo-size: ' + CONFIG.logoSize + 'px;',
    '}',
    '',
    '/* ── Overlay (fullscreen fixed) ── */',
    '.rw-loader-overlay {',
    '  position: fixed;',
    '  inset: 0;',
    '  z-index: 999999;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  pointer-events: all;',
    '  contain: layout style paint;',
    '}',
    '',
    '.rw-loader-backdrop {',
    '  position: absolute;',
    '  inset: 0;',
    '  background: var(--rw-surface);',
    '  backdrop-filter: blur(var(--rw-blur));',
    '  -webkit-backdrop-filter: blur(var(--rw-blur));',
    '  will-change: opacity;',
    '}',
    '',
    '/* ── Stage (centred content column) ── */',
    '.rw-loader-stage {',
    '  position: relative;',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: center;',
    '  gap: 20px;',
    '  contain: layout style paint;',
    '}',
    '',
    '/* ── Logo section ── */',
    '.rw-loader-logo-section {',
    '  position: relative;',
    '  width: var(--rw-logo-size);',
    '  height: var(--rw-logo-size);',
    '  flex-shrink: 0;',
    '}',
    '',
    '.rw-loader-logo-wrap {',
    '  position: absolute;',
    '  inset: 0;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  z-index: 2;',
    '}',
    '',
    '.rw-loader-logo {',
    '  width: 100%;',
    '  height: 100%;',
    '  object-fit: contain;',
    '  display: block;',
    '  will-change: transform, opacity;',
    '}',
    '',
    '/* Central glow behind logo */',
    '.rw-loader-logo-glow {',
    '  position: absolute;',
    '  top: 50%; left: 50%;',
    '  width: calc(var(--rw-logo-size) * 1.5);',
    '  height: calc(var(--rw-logo-size) * 1.5);',
    '  margin-left: calc(var(--rw-logo-size) * -0.75);',
    '  margin-top: calc(var(--rw-logo-size) * -0.75);',
    '  border-radius: 50%;',
    '  background: radial-gradient(circle, rgba(255,107,0,0.18) 0%, transparent 70%);',
    '  z-index: 0;',
    '  will-change: transform, opacity;',
    '}',
    '',
    '/* ── Orbit system ── */',
    '.rw-loader-orbit {',
    '  position: absolute;',
    '  top: 50%; left: 50%;',
    '  transform: translate(-50%, -50%);',
    '  z-index: 1;',
    '  width: ' + CONFIG.orbitSizes[0] + 'px;',
    '  height: ' + CONFIG.orbitSizes[0] + 'px;',
    '  pointer-events: none;',
    '  contain: layout style paint;',
    '}',
    '',
    '.rw-loader-orbit-ring {',
    '  position: absolute;',
    '  top: 50%; left: 50%;',
    '  border-radius: 50%;',
    '  border: 1.5px solid rgba(255,107,0,0.10);',
    '  border-top-color: rgba(255,107,0,0.55);',
    '  transform-origin: 0 0;',
    '  will-change: transform;',
    '}',
    '',
    '.rw-loader-orbit-ring--outer {',
    '  width: ' + CONFIG.orbitSizes[0] + 'px;',
    '  height: ' + CONFIG.orbitSizes[0] + 'px;',
    '  margin-left: ' + (-CONFIG.orbitSizes[0] / 2) + 'px;',
    '  margin-top: ' + (-CONFIG.orbitSizes[0] / 2) + 'px;',
    '  animation: rw-orbit-outer ' + CONFIG.orbitSpeeds[0] + 's linear infinite;',
    '}',
    '',
    '.rw-loader-orbit-ring--mid {',
    '  width: ' + CONFIG.orbitSizes[1] + 'px;',
    '  height: ' + CONFIG.orbitSizes[1] + 'px;',
    '  margin-left: ' + (-CONFIG.orbitSizes[1] / 2) + 'px;',
    '  margin-top: ' + (-CONFIG.orbitSizes[1] / 2) + 'px;',
    '  border-width: 1.2px;',
    '  animation: rw-orbit-mid ' + CONFIG.orbitSpeeds[1] + 's linear infinite;',
    '}',
    '',
    '.rw-loader-orbit-ring--inner {',
    '  width: ' + CONFIG.orbitSizes[2] + 'px;',
    '  height: ' + CONFIG.orbitSizes[2] + 'px;',
    '  margin-left: ' + (-CONFIG.orbitSizes[2] / 2) + 'px;',
    '  margin-top: ' + (-CONFIG.orbitSizes[2] / 2) + 'px;',
    '  border-width: 1px;',
    '  border-style: dashed;',
    '  border-color: rgba(255,107,0,0.18);',
    '  border-top-color: rgba(255,107,0,0.45);',
    '  animation: rw-orbit-inner ' + CONFIG.orbitSpeeds[2] + 's linear infinite;',
    '}',
    '',
    '/* Orbiting luminous particle (::after on each ring) */',
    '.rw-loader-orbit-ring::after {',
    '  content: "";',
    '  position: absolute;',
    '  top: -3.5px;',
    '  left: 50%;',
    '  margin-left: -3.5px;',
    '  width: 7px;',
    '  height: 7px;',
    '  border-radius: 50%;',
    '  background: var(--rw-accent);',
    '  box-shadow: 0 0 10px var(--rw-accent), 0 0 24px rgba(255,107,0,0.5);',
    '}',
    '',
    '.rw-loader-orbit-ring--mid::after {',
    '  width: 5px; height: 5px;',
    '  top: -2.5px;',
    '  margin-left: -2.5px;',
    '}',
    '',
    '.rw-loader-orbit-ring--inner::after {',
    '  width: 4px; height: 4px;',
    '  top: -2px;',
    '  margin-left: -2px;',
    '  box-shadow: 0 0 6px var(--rw-accent), 0 0 14px rgba(255,107,0,0.4);',
    '}',
    '',
    '@keyframes rw-orbit-outer {',
    '  from { transform: rotate(0deg); }',
    '  to   { transform: rotate(360deg); }',
    '}',
    '',
    '@keyframes rw-orbit-mid {',
    '  from { transform: rotate(180deg); }',
    '  to   { transform: rotate(-180deg); }',
    '}',
    '',
    '@keyframes rw-orbit-inner {',
    '  from { transform: rotate(90deg); }',
    '  to   { transform: rotate(450deg); }',
    '}',
    '',
    '@keyframes rw-glow-breathe {',
    '  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.95); }',
    '  50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.08); }',
    '}',
    '',
    '/* ── Brand wordmark ── */',
    '.rw-loader-brand {',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: center;',
    '  gap: 6px;',
    '}',
    '',
    '.rw-loader-title {',
    '  display: flex;',
    '  gap: 0;',
    '  font-family: "Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;',
    '  font-size: 28px;',
    '  font-weight: 700;',
    '  letter-spacing: -0.03em;',
    '  color: #fff;',
    '  line-height: 1;',
    '  user-select: none;',
    '}',
    '',
    '.rw-loader-char {',
    '  display: inline-block;',
    '  opacity: 0;',
    '  transform: translateY(14px);',
    '  will-change: transform, opacity;',
    '}',
    '',
    '.rw-loader-char--space {',
    '  width: 0.3em;',
    '}',
    '',
    '.rw-loader-underline {',
    '  width: 60px;',
    '  height: 2.5px;',
    '  border-radius: 2px;',
    '  background: var(--rw-accent);',
    '  transform: scaleX(0);',
    '  transform-origin: left center;',
    '  will-change: transform;',
    '}',
    '',
    '.rw-loader-tagline {',
    '  margin: 0;',
    '  font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;',
    '  font-size: 10px;',
    '  font-weight: 500;',
    '  letter-spacing: 0.14em;',
    '  text-transform: uppercase;',
    '  color: rgba(255,255,255,0.35);',
    '  opacity: 0;',
    '  will-change: opacity;',
    '}',
    '',
    '/* Character stagger delays are set via inline --i */',
    '.rw-loader-entered .rw-loader-char {',
    '  animation: rw-char-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '  animation-delay: calc(var(--i, 0) * ' + CONFIG.charStagger + 's + 0.15s);',
    '}',
    '',
    '.rw-loader-entered .rw-loader-underline {',
    '  animation: rw-underline-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '  animation-delay: 0.55s;',
    '}',
    '',
    '.rw-loader-entered .rw-loader-tagline {',
    '  animation: rw-tagline-in 0.4s ease-out forwards;',
    '  animation-delay: 0.75s;',
    '}',
    '',
    '@keyframes rw-char-in {',
    '  from { opacity: 0; transform: translateY(14px); filter: blur(4px); }',
    '  to   { opacity: 1; transform: translateY(0);    filter: blur(0); }',
    '}',
    '',
    '@keyframes rw-underline-in {',
    '  from { transform: scaleX(0); }',
    '  to   { transform: scaleX(1); }',
    '}',
    '',
    '@keyframes rw-tagline-in {',
    '  from { opacity: 0; transform: translateY(6px); }',
    '  to   { opacity: 1; transform: translateY(0); }',
    '}',
    '',
    '/* ── Progress section ── */',
    '.rw-loader-progress {',
    '  width: 220px;',
    '  max-width: 70vw;',
    '  opacity: 0;',
    '  will-change: opacity;',
    '}',
    '',
    '.rw-loader-progress-track {',
    '  position: relative;',
    '  width: 100%;',
    '  height: 2px;',
    '  border-radius: 2px;',
    '  background: rgba(255,255,255,0.08);',
    '  overflow: hidden;',
    '  contain: layout style paint;',
    '}',
    '',
    '.rw-loader-progress-fill {',
    '  position: absolute;',
    '  inset: 0;',
    '  border-radius: inherit;',
    '  background: linear-gradient(90deg, var(--rw-accent), #ff9633);',
    '  transform: scaleX(0);',
    '  transform-origin: left center;',
    '  will-change: transform;',
    '  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);',
    '}',
    '',
    '.rw-loader-progress-beam {',
    '  position: absolute;',
    '  top: 50%;',
    '  width: 60px;',
    '  height: 2px;',
    '  border-radius: 2px;',
    '  margin-top: -1px;',
    '  background: linear-gradient(90deg, transparent, var(--rw-accent), #fff);',
    '  opacity: 0;',
    '  will-change: transform, opacity;',
    '}',
    '',
    '.rw-loader-progress-glow {',
    '  position: absolute;',
    '  top: 50%;',
    '  width: 8px;',
    '  height: 8px;',
    '  border-radius: 50%;',
    '  margin-top: -4px;',
    '  margin-left: -4px;',
    '  background: var(--rw-accent);',
    '  box-shadow: 0 0 12px var(--rw-accent), 0 0 30px rgba(255,107,0,0.6);',
    '  opacity: 0;',
    '  will-change: transform, opacity;',
    '}',
    '',
    '/* ── Indeterminate sweeping beam ── */',
    '.rw-loader-progress--indeterminate .rw-loader-progress-beam {',
    '  opacity: 1;',
    '  animation: rw-beam-sweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;',
    '}',
    '',
    '.rw-loader-progress--indeterminate .rw-loader-progress-glow {',
    '  opacity: 1;',
    '  animation: rw-glow-sweep 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;',
    '}',
    '',
    '@keyframes rw-beam-sweep {',
    '  0%   { transform: translateX(-30px); }',
    '  50%  { transform: translateX(calc(220px - 30px)); }',
    '  100% { transform: translateX(-30px); }',
    '}',
    '',
    '@keyframes rw-glow-sweep {',
    '  0%   { transform: translateX(-4px); }',
    '  50%  { transform: translateX(calc(220px - 4px)); }',
    '  100% { transform: translateX(-4px); }',
    '}',
    '',
    '/* ── Entrance sequence (applied after mount) ── */',
    '.rw-loader-backdrop {',
    '  opacity: 0;',
    '  transition: opacity ' + (CONFIG.entranceMs * 0.6) + 'ms ease-out;',
    '}',
    '',
    '.rw-loader-entered .rw-loader-backdrop {',
    '  opacity: 1;',
    '}',
    '',
    '.rw-loader-logo {',
    '  opacity: 0;',
    '  transform: scale(0.85);',
    '  transition: opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1),',
    '              transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);',
    '  transition-delay: 0.05s;',
    '}',
    '',
    '.rw-loader-entered .rw-loader-logo {',
    '  opacity: 1;',
    '  transform: scale(1);',
    '}',
    '',
    '.rw-loader-logo-glow {',
    '  opacity: 0;',
    '  animation: none;',
    '}',
    '',
    '.rw-loader-entered .rw-loader-logo-glow {',
    '  animation: rw-glow-breathe 3s ease-in-out infinite;',
    '  animation-delay: 0.3s;',
    '}',
    '',
    '.rw-loader-progress {',
    '  transition: opacity 0.3s ease-out;',
    '  transition-delay: 0.9s;',
    '}',
    '',
    '.rw-loader-entered .rw-loader-progress {',
    '  opacity: 1;',
    '}',
    '',
    '/* ── Hide sequence ── */',
    '.rw-loader-hiding .rw-loader-stage {',
    '  opacity: 0;',
    '  transform: scale(0.97);',
    '  transition: opacity ' + CONFIG.fadeOutMs + 'ms ease-in,',
    '              transform ' + CONFIG.fadeOutMs + 'ms ease-in;',
    '}',
    '',
    '.rw-loader-hiding .rw-loader-backdrop {',
    '  opacity: 0;',
    '  transition: opacity ' + CONFIG.fadeOutMs + 'ms ease-in;',
    '}',
    '',
    '/* ── Success pulse ── */',
    '.rw-loader-success-pulse {',
    '  position: fixed;',
    '  inset: 0;',
    '  z-index: 999998;',
    '  pointer-events: none;',
    '  background: radial-gradient(circle, rgba(255,107,0,0.25) 0%, transparent 70%);',
    '  opacity: 0;',
    '  transform: scale(0.8);',
    '}',
    '',
    '.rw-loader-success-pulse--fire {',
    '  animation: rw-pulse-fire ' + CONFIG.successPulseMs + 'ms ease-out forwards;',
    '}',
    '',
    '@keyframes rw-pulse-fire {',
    '  0%   { opacity: 0;   transform: scale(0.8); }',
    '  40%  { opacity: 0.9; transform: scale(1); }',
    '  100% { opacity: 0;   transform: scale(1.3); }',
    '}',
    '',
    '/* ── Reduced motion ── */',
    '@media (prefers-reduced-motion: reduce) {',
    '  .rw-loader-orbit-ring,',
    '  .rw-loader-orbit-ring::after,',
    '  .rw-loader-logo-glow,',
    '  .rw-loader-progress-beam,',
    '  .rw-loader-progress-glow {',
    '    animation: none !important;',
    '    transition: none !important;',
    '  }',
    '',
    '  .rw-loader-entered .rw-loader-char {',
    '    animation: none !important;',
    '    opacity: 1;',
    '    transform: translateY(0);',
    '  }',
    '',
    '  .rw-loader-entered .rw-loader-underline {',
    '    animation: none !important;',
    '    transform: scaleX(1);',
    '  }',
    '',
    '  .rw-loader-entered .rw-loader-tagline {',
    '    animation: none !important;',
    '    opacity: 1;',
    '  }',
    '',
    '  .rw-loader-entered .rw-loader-logo-glow {',
    '    animation: none !important;',
    '    opacity: 0.6;',
    '  }',
    '}',
    '',
    '/* ── Responsive ── */',
    '@media (max-width: 480px) {',
    '  :root { --rw-logo-size: 56px; }',
    '  .rw-loader-title { font-size: 22px; }',
    '  .rw-loader-tagline { font-size: 9px; }',
    '  .rw-loader-progress { width: 180px; }',
    '}',
  ].join('\n')

  /* ================================================================
     HTML — skeleton injected once, reused across show/hide cycles
     ================================================================ */

  function buildHTML() {
    var chars = CONFIG.brandName.split('').map(function (ch, i) {
      var spaceClass = ch === ' ' ? ' rw-loader-char--space' : ''
      return '<span class="rw-loader-char' + spaceClass + '" style="--i:' + i + '" aria-hidden="true">' + ch + '</span>'
    }).join('')

    return [
      '<div class="rw-loader-overlay" role="alert" aria-live="polite" aria-busy="true" aria-label="Chargement de Right Way">',

      /* Backdrop blur surface */
      '<div class="rw-loader-backdrop"></div>',

      /* Success pulse — injected separately on hide */
      '<div class="rw-loader-success-pulse"></div>',

      /* Central stage */
      '<div class="rw-loader-stage">',

      /* ── Logo + Orbit ── */
      '<div class="rw-loader-logo-section">',
      '<div class="rw-loader-logo-glow"></div>',
      '<div class="rw-loader-orbit">',
      '<div class="rw-loader-orbit-ring rw-loader-orbit-ring--outer"></div>',
      '<div class="rw-loader-orbit-ring rw-loader-orbit-ring--mid"></div>',
      '<div class="rw-loader-orbit-ring rw-loader-orbit-ring--inner"></div>',
      '</div>',
      '<div class="rw-loader-logo-wrap">',
      '<img class="rw-loader-logo" src="' + CONFIG.logoPath + '" alt="Right Way" />',
      '</div>',
      '</div>',

      /* ── Brand wordmark ── */
      '<div class="rw-loader-brand">',
      '<h1 class="rw-loader-title" aria-label="' + CONFIG.brandName + '">',
      chars,
      '</h1>',
      '<div class="rw-loader-underline"></div>',
      '<p class="rw-loader-tagline">' + CONFIG.tagline + '</p>',
      '</div>',

      /* ── Progress bar ── */
      '<div class="rw-loader-progress">',
      '<div class="rw-loader-progress-track">',
      '<div class="rw-loader-progress-fill"></div>',
      '<div class="rw-loader-progress-beam"></div>',
      '<div class="rw-loader-progress-glow"></div>',
      '</div>',
      '</div>',

      '</div>', /* /.rw-loader-stage */
      '</div>', /* /.rw-loader-overlay */
    ].join('')
  }

  /* ================================================================
     Core — mount / unmount
     ================================================================ */

  function mount() {
    if (state.mounted) return

    /* Inject CSS once */
    var style = document.createElement('style')
    style.setAttribute('data-rw-loader', 'css')
    style.textContent = CSS
    document.head.appendChild(style)

    /* Inject HTML */
    var container = document.createElement('div')
    container.setAttribute('data-rw-loader', 'html')
    container.innerHTML = buildHTML()
    document.body.appendChild(container)

    /* Cache DOM refs */
    state.el.overlay = container.querySelector('.rw-loader-overlay')
    state.el.backdrop = container.querySelector('.rw-loader-backdrop')
    state.el.stage = container.querySelector('.rw-loader-stage')
    state.el.logo = container.querySelector('.rw-loader-logo')
    state.el.progress = container.querySelector('.rw-loader-progress')
    state.el.progressFill = container.querySelector('.rw-loader-progress-fill')
    state.el.progressBeam = container.querySelector('.rw-loader-progress-beam')
    state.el.progressGlow = container.querySelector('.rw-loader-progress-glow')
    state.el.successPulse = container.querySelector('.rw-loader-success-pulse')
    state.el.logoGlow = container.querySelector('.rw-loader-logo-glow')

    state.mounted = true
  }

  function unmount() {
    if (!state.mounted) return

    /* Remove injected <style> */
    var styleTag = document.querySelector('style[data-rw-loader="css"]')
    if (styleTag) styleTag.parentNode.removeChild(styleTag)

    /* Remove injected HTML wrapper */
    var htmlWrap = document.querySelector('div[data-rw-loader="html"]')
    if (htmlWrap) htmlWrap.parentNode.removeChild(htmlWrap)

    /* Cancel any running animation frame */
    cancelRAF()

    /* Reset state */
    state.mounted = false
    state.visible = false
    state.progress = -1
    state.hiding = false
    state.el = {}
  }

  /* ================================================================
     rAF loop — for smooth JS-driven animations (progress fill sync)
     ================================================================ */

  function cancelRAF() {
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }
  }

  function startRAF() {
    if (state.rafId !== null) return
    state.lastFrame = performance.now()
    function loop(now) {
      state.lastFrame = now
      /* No per-frame work needed currently; CSS handles continuous
         animations. The loop exists as a hook for future extensions
         (e.g. JS-driven particle physics) and to keep the rAF
         infrastructure in place. */
      state.rafId = requestAnimationFrame(loop)
    }
    state.rafId = requestAnimationFrame(loop)
  }

  /* ================================================================
     Progress — determinate / indeterminate
     ================================================================ */

  function setProgress(value) {
    if (!state.mounted) return

    /* Clamp */
    var v = Math.max(0, Math.min(100, Number(value) || 0))

    if (v > 0) {
      /* Switch to determinate */
      state.progress = v
      state.el.progress.classList.remove('rw-loader-progress--indeterminate')
      state.el.progressFill.style.transform = 'scaleX(' + (v / 100) + ')'
      state.el.progressBeam.style.opacity = '0'
      state.el.progressGlow.style.opacity = '0'
    }
  }

  function startIndeterminate() {
    if (!state.mounted) return
    state.progress = -1
    state.el.progress.classList.add('rw-loader-progress--indeterminate')
    state.el.progressFill.style.transform = 'scaleX(0)'
  }

  /* ================================================================
     Public API
     ================================================================ */

  /**
   * show()
   * Mount the overlay (if not already mounted) and play the entrance
   * animation. Progress starts indeterminate.
   */
  function show() {
    if (state.hiding) return /* ignore during hide sequence */

    mount()
    startRAF()

    /* Reset to pre-entrance state */
    state.el.overlay.classList.remove('rw-loader-entered', 'rw-loader-hiding')
    state.el.logo.style.opacity = ''
    state.el.logo.style.transform = ''
    state.el.progressFill.style.transform = 'scaleX(0)'
    state.el.successPulse.classList.remove('rw-loader-success-pulse--fire')
    state.el.successPulse.style.opacity = '0'
    state.el.successPulse.style.transform = 'scale(0.8)'

    /* Force layout to apply reset, then trigger entrance */
    void state.el.overlay.offsetWidth
    state.el.overlay.classList.add('rw-loader-entered')
    state.el.overlay.setAttribute('aria-busy', 'true')

    startIndeterminate()
    state.visible = true
  }

  /**
   * hide()
   * Complete progress → fire success pulse → fade out → remove.
   * Returns a Promise that resolves when the animation finishes.
   */
  function hide() {
    if (!state.mounted || !state.visible || state.hiding) {
      return Promise.resolve()
    }

    state.hiding = true

    return new Promise(function (resolve) {
      /* 1. Snap progress to 100 % */
      state.el.progress.classList.remove('rw-loader-progress--indeterminate')
      state.el.progressFill.style.transform = 'scaleX(1)'
      state.el.progressBeam.style.opacity = '0'
      state.el.progressGlow.style.opacity = '0'
      state.el.overlay.setAttribute('aria-busy', 'false')

      /* 2. After a short beat, fire success pulse */
      setTimeout(function () {
        state.el.successPulse.classList.add('rw-loader-success-pulse--fire')

        /* Pulse duration matches CSS animation */
        setTimeout(function () {
          /* 3. Start fade-out */
          state.el.overlay.classList.add('rw-loader-hiding')

          /* 4. After fade completes, tear down */
          setTimeout(function () {
            state.el.overlay.classList.remove('rw-loader-entered', 'rw-loader-hiding')
            state.el.successPulse.classList.remove('rw-loader-success-pulse--fire')
            state.el.successPulse.style.opacity = '0'
            state.el.successPulse.style.transform = 'scale(0.8)'

            cancelRAF()
            state.visible = false
            state.hiding = false
            state.progress = -1

            resolve()
          }, CONFIG.fadeOutMs + 50)
        }, CONFIG.successPulseMs)
      }, 180)
    })
  }

  /**
   * progress(value)
   * Set determinate progress 0–100. First call switches from
   * indeterminate to determinate mode.
   */
  function progress(value) {
    if (!state.mounted || state.hiding) return
    setProgress(value)
  }

  /**
   * destroy()
   * Immediately remove all injected CSS, HTML, listeners, and rAF
   * loops. No animation — just clean teardown.
   */
  function destroy() {
    cancelRAF()
    unmount()
  }

  /* ================================================================
     Export
     ================================================================ */

  window.RightWayLoader = {
    show: show,
    hide: hide,
    progress: progress,
    destroy: destroy,
  }
})()
