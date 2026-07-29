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

      const arc = root.current.querySelector('.progress__arc');
      gsap.set(arc, { strokeDasharray: CIRC, strokeDashoffset: CIRC });

      /* quickSetter writes the property straight to the element. The previous
         version built a fresh tween — from a selector string, with
         overwrite:true — on every scroll frame, which meant a DOM query plus a
         scan of the global timeline 60 times a second. Progress maps 1:1 to
         scroll position, so there was never anything for a tween to ease. */
      const setArc = gsap.quickSetter(arc, 'strokeDashoffset');

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => setArc(CIRC * (1 - self.progress)),
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
