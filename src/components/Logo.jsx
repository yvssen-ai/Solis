import { brandLogo } from '../data/images';

/**
 * The Solis mark.
 *
 * `src/assets/brand-logo.png` is the real logo, chroma-keyed off its flat green
 * background so the white line art drops cleanly onto any surface. On light
 * sections pass `invert` to render it in the brand green instead.
 *
 * If that file is ever removed, the inline placeholder below takes over — it
 * mirrors the logo's construction (a thin-line sun in place of the "o").
 */
export default function Logo({ className = '', invert = false, raysRef = null }) {
  if (brandLogo) {
    return (
      <img
        src={brandLogo}
        alt="Solis"
        className={`logo logo--file ${invert ? 'logo--invert' : ''} ${className}`}
      />
    );
  }

  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 12;
    return {
      x1: 60 + Math.cos(angle) * 15,
      y1: 21 + Math.sin(angle) * 15,
      x2: 60 + Math.cos(angle) * 20,
      y2: 21 + Math.sin(angle) * 20,
    };
  });

  return (
    <svg className={`logo ${className}`} viewBox="0 0 120 42" role="img" aria-label="Solis" fill="none">
      <g ref={raysRef} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <circle cx="60" cy="21" r="10" stroke="currentColor" strokeWidth="1.8" />
      <text
        x="60"
        y="34"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="7"
        letterSpacing="2"
        fill="currentColor"
      >
        SOLIS
      </text>
    </svg>
  );
}
