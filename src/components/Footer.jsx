import { useRef } from 'react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/gsap';

const LINKS = [
  { id: '#story', label: 'Story' },
  { id: '#menu', label: 'Menu' },
  { id: '#gallery', label: 'Gallery' },
  { id: '#visit', label: 'Visit' },
];

export default function Footer({ onNavigate }) {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      /* The wordmark rises out of the bottom edge as the footer arrives. */
      gsap.fromTo(
        '.footer__wordmark-inner',
        { yPercent: 42 },
        {
          yPercent: 0,
          ease: 'none',
          scrollTrigger: { trigger: '.footer__wordmark', start: 'top bottom', end: 'bottom bottom', scrub: 0.7 },
        }
      );

      gsap.from('.footer__col', {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'solis',
        stagger: 0.09,
        scrollTrigger: { trigger: '.footer__top', start: 'top 92%' },
      });

      gsap.to('.footer__rays', {
        rotate: -360,
        duration: 90,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });
    },
    { scope: root }
  );

  return (
    <footer className="footer" ref={root}>
      <div className="shell footer__top">
        <div className="footer__col footer__col--wide">
          <svg className="footer__mark" viewBox="0 0 120 120" aria-hidden="true">
            <g className="footer__rays">
              {Array.from({ length: 20 }, (_, i) => {
                const a = (Math.PI * 2 * i) / 20;
                return (
                  <line
                    key={i}
                    x1={60 + Math.cos(a) * 34}
                    y1={60 + Math.sin(a) * 34}
                    x2={60 + Math.cos(a) * 46}
                    y2={60 + Math.sin(a) * 46}
                    stroke="var(--sun)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
            <circle cx="60" cy="60" r="24" fill="var(--sun)" />
          </svg>
          <p className="footer__blurb">
            Solis — cafe &amp; bakery. Coffee roasted here, dough folded here, everything
            out before the sun is properly up.
          </p>
        </div>

        <nav className="footer__col">
          <p className="footer__label">Explore</p>
          <ul>
            {LINKS.map((l) => (
              <li key={l.id}>
                <a
                  href={l.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate?.(l.id);
                  }}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__col">
          <p className="footer__label">Follow</p>
          <ul>
            <li>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href="https://facebook.com" target="_blank" rel="noreferrer">
                Facebook
              </a>
            </li>
            <li>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer">
                TikTok
              </a>
            </li>
          </ul>
        </div>

        <div className="footer__col">
          <p className="footer__label">Hours</p>
          <ul>
            <li>Mon — Thu · 07:00 — 00:00</li>
            <li>Fri — Sat · 07:00 — 02:00</li>
            <li>Sun · 08:00 — 00:00</li>
          </ul>
        </div>
      </div>

      <div className="footer__wordmark" aria-hidden="true">
        <span className="footer__wordmark-inner">SOLIS</span>
      </div>

      <div className="shell footer__bottom">
        <p>© {new Date().getFullYear()} Solis Cafe &amp; Bakery. All prices in L.E.</p>
        <button
          className="footer__totop"
          onClick={() => onNavigate?.('#top')}
          aria-label="Back to top"
        >
          Back to top ↑
        </button>
      </div>
    </footer>
  );
}
