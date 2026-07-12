import './TruckLoader.css';

/**
 * Branded loading overlay featuring an animated delivery truck driving
 * along a route toward a destination pin.  Used as the Suspense fallback
 * for lazy routes and the initial auth-verification placeholder.
 *
 * Props
 *   fullscreen  – (default true) 100vw × 100vh ink overlay
 *   fullscreen=false – fills parent container, lighter background
 */
export default function TruckLoader({ fullscreen = true }) {
  return (
    <div className={`truck-loader${fullscreen ? ' truck-loader--full' : ''}`}>
      <div className="truck-loader-inner">
        {/* Brand wordmark */}
        <div className="truck-loader-brand">
          Right Way<span className="truck-loader-brand-dot">.</span>
        </div>

        {/* Animated truck SVG */}
        <div className="truck-loader-icon">
          <svg
            viewBox="0 0 680 420"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="truck-loader-svg"
          >
            {/* White tile card */}
            <rect
              x="160" y="20" width="360" height="380" rx="28"
              fill="#FFFFFF" stroke="#14151A" strokeOpacity="0.1" strokeWidth="1"
            />

            {/* Route path — dashes flow forward */}
            <path
              className="truck-route"
              d="M215 310 C 300 250, 380 330, 465 252"
              fill="none"
              stroke="#14151A"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="4 14"
            />

            {/* Start dot */}
            <circle cx="215" cy="310" r="6" fill="#14151A" />
            <circle cx="215" cy="310" r="2.5" fill="#FFFFFF" />

            {/* Destination pin — pulses */}
            <g className="truck-pin">
              <circle cx="465" cy="252" r="4" fill="none" stroke="#E10600" strokeWidth="2" />
              <path
                d="M465 248 c -11 -15 -15 -21 -15 -30 a15 15 0 1 1 30 0 c 0 9 -4 15 -15 30 z"
                fill="#E10600"
              />
              <circle cx="465" cy="218" r="6" fill="#FFFFFF" />
            </g>

            {/* Truck — drives along the route */}
            <g className="truck-driver">
              <g className="truck-bounce">
                {/* Speed lines behind truck */}
                <g className="truck-speed-lines" stroke="#E10600" strokeWidth="2.5" strokeLinecap="round" opacity="0">
                  <line x1="-48" y1="-28" x2="-58" y2="-28" />
                  <line x1="-46" y1="-20" x2="-62" y2="-20" />
                </g>

                {/* Cargo box */}
                <rect x="-38" y="-34" width="40" height="26" rx="4" fill="#14151A" />

                {/* Cab */}
                <path
                  d="M4 -34 h13 a4 4 0 0 1 3.2 1.6 L30 -20 v9 a3 3 0 0 1 -3 3 H4 z"
                  fill="#E10600"
                />

                {/* Windshield */}
                <path d="M8 -30 h8 l7 9 H8 z" fill="#FFFFFF" />

                {/* Side stripe */}
                <rect x="-38" y="-11" width="68" height="3" rx="1.5" fill="#14151A" />

                {/* Rear wheel */}
                <g transform="translate(-24,-7)">
                  <circle r="8" fill="#14151A" />
                  <circle r="3.5" fill="#FFFFFF" />
                  <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#14151A" strokeWidth="1.4" />
                </g>

                {/* Front wheel */}
                <g transform="translate(16,-7)">
                  <circle r="8" fill="#14151A" />
                  <circle r="3.5" fill="#FFFFFF" />
                  <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#14151A" strokeWidth="1.4" />
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* Loading text */}
        <p className="truck-loader-text">Chargement en cours…</p>
      </div>
    </div>
  );
}
