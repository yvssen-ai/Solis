import { useRef } from 'react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/gsap';
import { img } from '../data/images';

/* The brand line is the headline — the wordmark is already in the nav and on
   the storefront behind it, so repeating it a third time only competes. */
const TITLE = ['Your', 'sun', 'will', 'rise', 'from', 'here'];

export default function Hero({ loaded, onNavigate }) {
  const root = useRef(null);
  const hero = img(0);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();

      /* ---- Entrance, fired the moment the preloader hands over ---- */
      if (loaded && !reduced) {
        const tl = gsap.timeline({ defaults: { ease: 'solis' } });

        tl.fromTo(
          '.hero__media',
          { scale: 1.35, autoAlpha: 0 },
          { scale: 1, autoAlpha: 1, duration: 1.8 }
        )
          .fromTo(
            '.hero__sun',
            { scale: 0.72, opacity: 0, y: 160 },
            { scale: 1, opacity: 0.45, y: 0, duration: 2.1 },
            0.15
          )
          .fromTo(
            '.hero__char',
            { yPercent: 118 },
            { yPercent: 0, duration: 1.15, stagger: 0.085 },
            0.35
          )
          .fromTo(
            '[data-hero-fade]',
            { y: 34, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.11 },
            0.9
          );
      } else if (loaded) {
        gsap.set('.hero__media, .hero__sun, .hero__char, [data-hero-fade]', {
          autoAlpha: 1,
          y: 0,
          yPercent: 0,
          scale: 1,
        });
      }

      if (reduced) return;

      /* ---- The sun keeps turning, always ---- */
      gsap.to('.hero__rays', {
        rotate: 360,
        duration: 120,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });

      gsap.to('.hero__glow', {
        scale: 1.12,
        opacity: 0.75,
        duration: 4.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      /* ---- Scroll-out: title lifts, sun sets, image dims ---- */
      gsap
        .timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
        .to('.hero__title', { yPercent: -55, autoAlpha: 0.15, ease: 'none' }, 0)
        /* It keeps rising as you leave. */
        .to('.hero__sun', { yPercent: -28, ease: 'none' }, 0)
        .to('.hero__foot', { autoAlpha: 0, y: 40, ease: 'none' }, 0)
        .to('.hero__scrim', { opacity: 0.95, ease: 'none' }, 0);

      /* Slow drift on the photograph itself */
      gsap.to('.hero__img', {
        yPercent: 14,
        scale: 1.14,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      /* Bobbing scroll cue */
      gsap.to('.hero__cue-dot', {
        y: 16,
        duration: 1.3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    },
    { scope: root, dependencies: [loaded] }
  );

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__media">
        {hero && <img className="hero__img" src={hero.src} alt={hero.alt} fetchpriority="high" />}
        <div className="hero__scrim" />
        <div className="hero__grain" />
      </div>

      {/* Drawn to match the logo: an open thin-line circle with straight rays. */}
      <svg className="hero__sun" viewBox="0 0 400 400" aria-hidden="true">
        <defs>
          <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--honey)" stopOpacity="0.34" />
            <stop offset="55%" stopColor="var(--sun)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--sun)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="hero__glow" cx="200" cy="200" r="190" fill="url(#heroGlow)" />
        <g className="hero__rays">
          {Array.from({ length: 24 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 24;
            return (
              <line
                key={i}
                x1={200 + Math.cos(a) * 122}
                y1={200 + Math.sin(a) * 122}
                x2={200 + Math.cos(a) * 158}
                y2={200 + Math.sin(a) * 158}
                stroke="var(--white)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.75"
              />
            );
          })}
        </g>
        <circle cx="200" cy="200" r="100" fill="none" stroke="var(--white)" strokeWidth="3.5" opacity="0.85" />
      </svg>

      <div className="hero__body shell">
        <p className="eyebrow hero__eyebrow" data-hero-fade>
          Cafe &amp; Bakery
        </p>

        <h1 className="hero__title">
          <span className="sr-only">Solis — your sun will rise from here</span>
          <span className="hero__title-row" aria-hidden="true">
            {TITLE.map((word, i) => (
              <span className="hero__char-wrap" key={i}>
                <span className="hero__char">{word}</span>
              </span>
            ))}
          </span>
        </h1>

        <p className="hero__sub" data-hero-fade>
          Specialty coffee, ceremonial matcha, and pastry laminated by hand — long before
          the city wakes up.
        </p>

        <div className="hero__actions" data-hero-fade>
          <button className="btn" onClick={() => onNavigate?.('#menu')}>
            See the menu
          </button>
          <button className="btn btn--ghost" onClick={() => onNavigate?.('#visit')}>
            Find us
          </button>
        </div>
      </div>

      <div className="hero__foot shell">
        <div className="hero__cue" data-hero-fade>
          <span className="hero__cue-line">
            <span className="hero__cue-dot" />
          </span>
          <span>Scroll</span>
        </div>
        <p className="hero__hours" data-hero-fade>
          Open daily <span>07:00 — 01:00</span>
        </p>
      </div>
    </section>
  );
}
