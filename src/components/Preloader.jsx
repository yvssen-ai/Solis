import { useRef, useState } from 'react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/gsap';

/**
 * Sunrise preloader: the rays draw themselves, the disc rises, a counter runs
 * to 100, then the screen splits into slats that lift away to reveal the hero.
 */
export default function Preloader({ onDone }) {
  const root = useRef(null);
  const raysRef = useRef(null);
  const counterRef = useRef(null);
  const [gone, setGone] = useState(false);

  useGSAP(
    () => {
      const finish = () => {
        setGone(true);
        onDone?.();
      };

      if (prefersReducedMotion()) {
        gsap.set(root.current, { autoAlpha: 0 });
        finish();
        return;
      }

      const counter = { value: 0 };
      const rays = raysRef.current.querySelectorAll('line');

      const tl = gsap.timeline({ onComplete: finish });

      tl.set(root.current, { autoAlpha: 1 })
        .fromTo(
          '.preloader__disc',
          { scale: 0.2, yPercent: 60, autoAlpha: 0 },
          { scale: 1, yPercent: 0, autoAlpha: 1, duration: 1.1, ease: 'solis' }
        )
        .fromTo(
          rays,
          { drawSVG: '50% 50%', autoAlpha: 0 },
          {
            drawSVG: '0% 100%',
            autoAlpha: 1,
            duration: 0.7,
            ease: 'solis',
            stagger: { each: 0.045, from: 'center' },
          },
          '-=0.75'
        )
        .fromTo(
          '.preloader__horizon',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.8, ease: 'solis' },
          '-=0.6'
        )
        .fromTo(
          '.preloader__letter',
          { yPercent: 120, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'solis', stagger: 0.05 },
          '-=0.5'
        )
        .to(
          counter,
          {
            value: 100,
            duration: 1.5,
            ease: 'power2.inOut',
            onUpdate: () => {
              if (counterRef.current) {
                counterRef.current.textContent = String(Math.round(counter.value)).padStart(2, '0');
              }
            },
          },
          0.15
        )
        /* Hold on a fully-formed sun for a beat before the reveal. */
        .to('.preloader__inner', { autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, '+=0.25')
        .to(
          '.preloader__slat',
          {
            yPercent: -101,
            duration: 1.05,
            ease: 'solis',
            stagger: { each: 0.075, from: 'start' },
          },
          '-=0.2'
        )
        .set(root.current, { autoAlpha: 0 });
    },
    { scope: root, dependencies: [] }
  );

  if (gone) return null;

  return (
    <div className="preloader" ref={root} aria-hidden="true">
      <div className="preloader__slats">
        {Array.from({ length: 5 }, (_, i) => (
          <span className="preloader__slat" key={i} />
        ))}
      </div>

      <div className="preloader__inner">
        <svg className="preloader__mark" viewBox="0 0 120 52" fill="none">
          <g ref={raysRef} stroke="var(--white)" strokeWidth="2.2" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (Math.PI / 11) * i + Math.PI;
              return (
                <line
                  key={i}
                  x1={60 + Math.cos(a) * 22}
                  y1={40 + Math.sin(a) * 22}
                  x2={60 + Math.cos(a) * 30}
                  y2={40 + Math.sin(a) * 30}
                />
              );
            })}
          </g>
          <circle className="preloader__disc" cx="60" cy="40" r="13" fill="none" stroke="var(--white)" strokeWidth="2.4" />
          <path
            className="preloader__horizon"
            d="M32 40 H 88"
            stroke="var(--white)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>

        <p className="preloader__word">
          {'SOLIS'.split('').map((letter, i) => (
            <span className="preloader__letter" key={i}>
              {letter}
            </span>
          ))}
        </p>

        <p className="preloader__count">
          <span ref={counterRef}>00</span>
        </p>
      </div>
    </div>
  );
}
