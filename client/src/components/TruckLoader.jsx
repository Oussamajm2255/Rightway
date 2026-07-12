import './TruckLoader.css';

/**
 * Premium animated loading overlay.  An editorial brand wordmark with
 * a shimmer sweep sits above a hand-crafted SVG scene: a delivery truck
 * drives from a warehouse past floating route particles toward a pulsing
 * destination pin, with glowing trails, dust, exhaust, and layered
 * environment silhouettes.
 *
 * Props
 *   fullscreen  – (default true) 100vw×100vh ink overlay
 *   fullscreen=false – fills parent, lighter backdrop
 */
export default function TruckLoader({ fullscreen = true }) {
  return (
    <div className={`truck-loader${fullscreen ? ' truck-loader--full' : ''}`}>
      <div className="truck-loader-inner">

        {/* ── Brand wordmark with red shimmer sweep ── */}
        <div className="truck-loader-brand">
          <span className="truck-loader-brand-text">Right Way</span>
          <span className="truck-loader-brand-dot">.</span>
        </div>
        <p className="truck-loader-sub">STE RIGHT WAY FOR TRADING</p>

        {/* ── Scene ── */}
        <div className="truck-loader-icon">
          <svg
            viewBox="0 0 680 440"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="truck-loader-svg"
          >
            <defs>
              {/* Card gradient */}
              <linearGradient id="tcard" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E1E24" />
                <stop offset="100%" stopColor="#14151A" />
              </linearGradient>

              {/* Route glow gradient */}
              <linearGradient id="rglow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E10600" stopOpacity="0" />
                <stop offset="40%" stopColor="#E10600" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#E10600" stopOpacity="0.6" />
              </linearGradient>

              {/* Headlight gradient */}
              <radialGradient id="headlight">
                <stop offset="0%" stopColor="#FFD700" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
              </radialGradient>

              {/* Pin glow gradient */}
              <radialGradient id="pinglow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E10600" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#E10600" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* ── Card tile ── */}
            <rect
              x="120" y="24" width="440" height="392" rx="32"
              fill="url(#tcard)"
              stroke="#2A2A32" strokeWidth="1"
            />

            {/* Map grid dots */}
            <g opacity="0.06">
              {gridDots(16, 8, 138, 42, 404, 356)}
            </g>

            {/* ── Environment silhouettes ── */}
            {/* Origin warehouse (left) */}
            <g className="truck-warehouse" opacity="0.18">
              <rect x="158" y="294" width="52" height="52" rx="3" fill="#9A9AA2" />
              <rect x="162" y="298" width="20" height="22" rx="2" fill="#14151A" />
              <rect x="186" y="298" width="20" height="22" rx="2" fill="#14151A" />
              <rect x="162" y="324" width="20" height="18" rx="2" fill="#14151A" />
              <rect x="186" y="324" width="20" height="18" rx="2" fill="#14151A" />
              <path d="M158 294 l26 -12 l26 12" fill="#9A9AA2" stroke="#14151A" strokeWidth="1" />
            </g>

            {/* Destination building (right) */}
            <g className="truck-dest" opacity="0.22">
              <rect x="466" y="240" width="18" height="72" rx="2" fill="#9A9AA2" />
              <rect x="488" y="220" width="36" height="92" rx="3" fill="#9A9AA2" />
              <rect x="468" y="244" width="14" height="12" rx="1.5" fill="#FFD700" opacity="0.3" />
              <rect x="492" y="224" width="8" height="10" rx="1.5" fill="#FFD700" opacity="0.15" />
              <rect x="504" y="224" width="8" height="10" rx="1.5" fill="#FFD700" opacity="0.15" />
              <rect x="496" y="238" width="8" height="10" rx="1.5" fill="#FFD700" opacity="0.15" />
              <rect x="508" y="238" width="8" height="10" rx="1.5" fill="#FFD700" opacity="0.15" />
            </g>

            {/* ── Route glow underlay ── */}
            <path
              className="truck-route-glow"
              d="M210 320 C 300 260, 400 340, 480 265"
              fill="none"
              stroke="url(#rglow)"
              strokeWidth="12"
              strokeLinecap="round"
              opacity="0"
            />

            {/* ── Route path ── */}
            <path
              className="truck-route"
              d="M210 320 C 300 260, 400 340, 480 265"
              fill="none"
              stroke="#3A3A44"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="5 16"
            />

            {/* Start dot */}
            <circle cx="210" cy="320" r="7" fill="#1E1E24" stroke="#4A4A54" strokeWidth="1.5" />
            <circle cx="210" cy="320" r="3" fill="#9A9AA2" />

            {/* ── Destination pin ── */}
            <g className="truck-pin-group">
              {/* Glow rings */}
              <circle className="truck-pin-glow-1" cx="480" cy="265" r="24" fill="url(#pinglow)" />
              <circle className="truck-pin-glow-2" cx="480" cy="265" r="16" fill="url(#pinglow)" />
              {/* Pin body */}
              <g className="truck-pin">
                <circle cx="480" cy="265" r="5" fill="none" stroke="#E10600" strokeWidth="2.5" />
                <path
                  d="M480 260 c -13 -16 -18 -22 -18 -34 a18 18 0 1 1 36 0 c 0 12 -5 18 -18 34 z"
                  fill="#E10600"
                />
                <circle cx="480" cy="226" r="7" fill="#1E1E24" />
                <circle cx="480" cy="226" r="3" fill="#FFD700" opacity="0.5" />
              </g>
            </g>

            {/* ── Route particles ── */}
            <circle className="truck-rp rp1" cx="280" cy="293" r="2" fill="#E10600" opacity="0" />
            <circle className="truck-rp rp2" cx="330" cy="288" r="1.5" fill="#E10600" opacity="0" />
            <circle className="truck-rp rp3" cx="390" cy="304" r="2" fill="#E10600" opacity="0" />
            <circle className="truck-rp rp4" cx="440" cy="285" r="1.5" fill="#E10600" opacity="0" />

            {/* ── Truck ── */}
            <g className="truck-driver">
              {/* Headlight beam */}
              <g className="truck-headlight" opacity="0">
                <ellipse cx="38" cy="-20" rx="18" ry="8" fill="url(#headlight)" />
              </g>

              {/* Exhaust puffs */}
              <g className="truck-exhaust">
                <circle cx="-44" cy="-22" r="3" fill="#9A9AA2" opacity="0" className="truck-exh puff1" />
                <circle cx="-52" cy="-18" r="2.5" fill="#9A9AA2" opacity="0" className="truck-exh puff2" />
                <circle cx="-58" cy="-14" r="2" fill="#9A9AA2" opacity="0" className="truck-exh puff3" />
              </g>

              {/* Dust behind wheels */}
              <circle cx="-24" cy="-2" r="2" fill="#9A9AA2" opacity="0" className="truck-dust dust1" />
              <circle cx="-30" cy="-4" r="1.5" fill="#9A9AA2" opacity="0" className="truck-dust dust2" />
              <circle cx="-34" cy="0" r="1.5" fill="#9A9AA2" opacity="0" className="truck-dust dust3" />

              {/* Speed lines */}
              <g className="truck-speed-lines" stroke="#E10600" strokeWidth="2" strokeLinecap="round" opacity="0">
                <line x1="-48" y1="-28" x2="-60" y2="-28" />
                <line x1="-46" y1="-20" x2="-64" y2="-20" />
                <line x1="-44" y1="-12" x2="-56" y2="-12" />
              </g>

              <g className="truck-bounce">
                {/* Main chassis rail */}
                <rect x="-40" y="-10" width="74" height="3" rx="1.5" fill="#2A2A32" />

                {/* Cargo box */}
                <rect x="-40" y="-36" width="44" height="26" rx="5" fill="#1E1E24" />
                <rect x="-38" y="-34" width="40" height="22" rx="4" fill="#252530" />
                {/* Cargo box trim */}
                <line x1="-40" y1="-24" x2="4" y2="-24" stroke="#333340" strokeWidth="1" />
                <line x1="-40" y1="-18" x2="4" y2="-18" stroke="#333340" strokeWidth="1" />

                {/* RW monogram on cargo */}
                <text x="-18" y="-15" fontSize="9" fontWeight="700" fill="#E10600" fontFamily="Space Grotesk, sans-serif" textAnchor="middle" letterSpacing="2" opacity="0.7">
                  RW
                </text>

                {/* Cab */}
                <path
                  d="M8 -36 h14 a4 4 0 0 1 3.5 2 L36 -20 v10 a3 3 0 0 1 -3 3 H8 z"
                  fill="#E10600"
                />
                {/* Cab roof highlight */}
                <path
                  d="M9 -35 h12 a2 2 0 0 1 1.5 1 l8 10"
                  fill="none"
                  stroke="#FF3B33"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.5"
                />

                {/* Windshield */}
                <path d="M12 -30 h7 l7 9 H12 z" fill="#0A0A0B" />
                {/* Windshield reflection */}
                <path d="M13 -28 h3 l3 4 H13 z" fill="#FFFFFF" opacity="0.15" />

                {/* Headlight */}
                <rect x="32" y="-22" width="4" height="5" rx="1.5" fill="#FFD700" />

                {/* Front bumper */}
                <rect x="32" y="-8" width="6" height="3" rx="1" fill="#1E1E24" />

                {/* Rear wheel */}
                <g transform="translate(-22,-6)">
                  <circle r="9" fill="#14151A" />
                  <circle r="9" fill="none" stroke="#333340" strokeWidth="1" />
                  <circle r="4" fill="#1E1E24" />
                  <circle r="1.8" fill="#555560" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#333340" strokeWidth="1.2" />
                  <line x1="0" y1="-4" x2="0" y2="4" stroke="#333340" strokeWidth="1.2" />
                </g>

                {/* Front wheel */}
                <g transform="translate(18,-6)">
                  <circle r="9" fill="#14151A" />
                  <circle r="9" fill="none" stroke="#333340" strokeWidth="1" />
                  <circle r="4" fill="#1E1E24" />
                  <circle r="1.8" fill="#555560" />
                  <line x1="-4" y1="0" x2="4" y2="0" stroke="#333340" strokeWidth="1.2" />
                  <line x1="0" y1="-4" x2="0" y2="4" stroke="#333340" strokeWidth="1.2" />
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* ── Loading indicator ── */}
        <div className="truck-loader-bar">
          <div className="truck-loader-bar-fill" />
        </div>
        <p className="truck-loader-text">Préparation de votre espace…</p>
      </div>
    </div>
  );
}

/* ▸ Tiny helper: generate a grid of faint dots for the card background */
function gridDots(spacing, radius, x0, y0, w, h) {
  const dots = [];
  for (let x = x0; x <= x0 + w; x += spacing) {
    for (let y = y0; y <= y0 + h; y += spacing) {
      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={radius} fill="#FFFFFF" />);
    }
  }
  return dots;
}
