import { brandLogo } from '../data/images';

/**
 * The Solis mark.
 *
 * If you drop a file at `src/assets/brand-logo.svg` (or .png/.webp) it is used
 * automatically and this placeholder disappears — no code change needed.
 *
 * The placeholder is drawn inline with `currentColor` so it inherits the colour
 * of whatever surface it sits on, and so GSAP can animate the individual rays.
 */
export default function Logo({ withWordmark = true, className = '', raysRef = null }) {
  if (brandLogo) {
    return <img src={brandLogo} alt="Solis" className={`logo logo--file ${className}`} />;
  }

  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (Math.PI / 11) * i + Math.PI;
    return {
      x1: 60 + Math.cos(angle) * 23,
      y1: 33 + Math.sin(angle) * 23,
      x2: 60 + Math.cos(angle) * 29,
      y2: 33 + Math.sin(angle) * 29,
    };
  });

  return (
    <svg
      className={`logo ${className}`}
      viewBox={withWordmark ? '0 0 120 66' : '0 0 120 42'}
      role="img"
      aria-label="Solis"
      fill="none"
    >
      <g ref={raysRef} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <circle cx="60" cy="33" r="15" fill="currentColor" />
      <path d="M39 33 H 81" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {withWordmark && (
        <text
          x="60"
          y="61"
          textAnchor="middle"
          fontFamily="Fraunces, Georgia, serif"
          fontSize="17"
          letterSpacing="5"
          fill="currentColor"
        >
          SOLIS
        </text>
      )}
    </svg>
  );
}
