import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';

const WORDS = [
  'Freshly baked at 4am',
  'Single origin',
  'Ceremonial matcha',
  'Hand laminated',
  'Roasted in house',
  'Open till late',
];

/**
 * Two ribbons drifting in opposite directions. Scrolling speeds them up and
 * flips their direction — a small piece of feedback that makes the whole page
 * feel physical.
 */
export default function Marquee() {
  const root = useRef(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const tracks = gsap.utils.toArray('.marquee__track');

      const loops = tracks.map((track, i) => {
        const dir = i % 2 === 0 ? -1 : 1;
        gsap.set(track, { xPercent: dir === -1 ? 0 : -50 });
        return gsap.to(track, {
          xPercent: dir === -1 ? -50 : 0,
          duration: 26 + i * 6,
          ease: 'none',
          repeat: -1,
        });
      });

      /* Scroll velocity drives speed; scroll direction drives sign. */
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          const boost = gsap.utils.clamp(1, 6, 1 + Math.abs(self.getVelocity()) / 900);
          loops.forEach((loop) => {
            gsap.to(loop, {
              timeScale: boost * self.direction,
              duration: 0.35,
              overwrite: true,
            });
          });
        },
      });

      gsap.to('.marquee', {
        backgroundPositionX: '100%',
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    },
    { scope: root }
  );

  const row = (key) => (
    <div className="marquee__row" key={key}>
      <div className="marquee__track">
        {[0, 1].map((copy) => (
          <div className="marquee__group" key={copy} aria-hidden={copy === 1}>
            {WORDS.map((word) => (
              <span className="marquee__item" key={word}>
                {word}
                <svg className="marquee__star" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="marquee" ref={root} aria-label="What Solis is known for">
      {row('a')}
      {row('b')}
    </section>
  );
}
