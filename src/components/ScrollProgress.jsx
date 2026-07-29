import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';

/**
 * A sun that tracks reading progress: the arc fills as you move down the page
 * and the disc travels with it. Sits above the fold-out menu, below the nav.
 */
export default function ScrollProgress() {
  const root = useRef(null);
  const R = 15;
  const CIRC = 2 * Math.PI * R;

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.set('.progress__arc', { strokeDasharray: CIRC, strokeDashoffset: CIRC });

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          gsap.to('.progress__arc', {
            strokeDashoffset: CIRC * (1 - self.progress),
            duration: 0.25,
            ease: 'none',
            overwrite: true,
          });
        },
      });

      /* Only appears once you have actually started reading. */
      gsap.fromTo(
        root.current,
        { autoAlpha: 0, scale: 0.6 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.5,
          ease: 'solis',
          scrollTrigger: { start: 'top -320', end: 99999, toggleActions: 'play none none reverse' },
        }
      );
    },
    { scope: root }
  );

  return (
    <div className="progress" ref={root} aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <circle className="progress__rail" cx="20" cy="20" r={R} />
        <circle className="progress__arc" cx="20" cy="20" r={R} />
        <circle className="progress__dot" cx="20" cy="20" r="5" />
      </svg>
    </div>
  );
}
