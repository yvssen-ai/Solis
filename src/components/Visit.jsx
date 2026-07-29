import { useRef } from 'react';
import { gsap, useGSAP, splitLines, prefersReducedMotion } from '../lib/gsap';
import { img } from '../data/images';
import Photo from './Photo';

const HOURS = [
  { days: 'Monday — Thursday', time: '07:00 — 00:00' },
  { days: 'Friday — Saturday', time: '07:00 — 02:00' },
  { days: 'Sunday', time: '08:00 — 00:00' },
];

const DETAILS = [
  { label: 'Address', value: '12 Sunrise Street, Sheikh Zayed, Giza' },
  { label: 'Phone', value: '+20 100 000 0000', href: 'tel:+201000000000' },
  { label: 'Email', value: 'hello@solis.cafe', href: 'mailto:hello@solis.cafe' },
  { label: 'Instagram', value: '@solis.cafe', href: 'https://instagram.com' },
];

export default function Visit() {
  const root = useRef(null);
  const media = img(7); // the two chairs, late afternoon

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const split = splitLines('.visit__title');
      gsap.from(split.lines, {
        yPercent: 115,
        duration: 1.1,
        ease: 'solis',
        stagger: 0.08,
        scrollTrigger: { trigger: '.visit__title', start: 'top 85%' },
      });

      gsap.from('.visit__row', {
        x: -28,
        autoAlpha: 0,
        duration: 0.75,
        ease: 'solis',
        stagger: 0.08,
        scrollTrigger: { trigger: '.visit__hours', start: 'top 85%' },
      });

      gsap.from('.visit__detail', {
        y: 26,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'solis',
        stagger: 0.08,
        scrollTrigger: { trigger: '.visit__details', start: 'top 88%' },
      });

      gsap.fromTo(
        '.visit__media',
        { clipPath: 'inset(12% 12% 12% 12% round 24px)' },
        {
          clipPath: 'inset(0% 0% 0% 0% round 24px)',
          ease: 'none',
          scrollTrigger: { trigger: '.visit__media', start: 'top 90%', end: 'top 35%', scrub: 0.6 },
        }
      );

      /* A sun that literally sets as the section scrolls past. */
      gsap.fromTo(
        '.visit__sun',
        { yPercent: -20, rotate: 0 },
        {
          yPercent: 55,
          rotate: 90,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
        }
      );
    },
    { scope: root }
  );

  return (
    <section className="section visit" id="visit" ref={root}>
      <svg className="visit__sun" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="70" fill="none" stroke="var(--white)" strokeWidth="4" opacity="0.3" />
        {Array.from({ length: 20 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 20;
          return (
            <line
              key={i}
              x1={150 + Math.cos(a) * 88}
              y1={150 + Math.sin(a) * 88}
              x2={150 + Math.cos(a) * 118}
              y2={150 + Math.sin(a) * 118}
              stroke="var(--white)"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.3"
            />
          );
        })}
      </svg>

      <div className="shell visit__grid">
        <div className="visit__text">
          <p className="eyebrow">Visit us</p>
          <h2 className="visit__title">Come for the pastry. Stay until the light goes.</h2>

          <div className="visit__hours">
            <p className="visit__subhead">Hours</p>
            {HOURS.map((row) => (
              <div className="visit__row" key={row.days}>
                <span>{row.days}</span>
                <span className="visit__rule" aria-hidden="true" />
                <span className="visit__time">{row.time}</span>
              </div>
            ))}
          </div>

          <div className="visit__details">
            <p className="visit__subhead">Find us</p>
            <dl>
              {DETAILS.map((d) => (
                <div className="visit__detail" key={d.label}>
                  <dt>{d.label}</dt>
                  <dd>
                    {d.href ? (
                      <a href={d.href} target={d.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                        {d.value}
                      </a>
                    ) : (
                      d.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <a className="btn visit__cta" href="https://maps.google.com" target="_blank" rel="noreferrer">
            Open in maps
          </a>
        </div>

        <figure className="visit__media">
          {media && (
            <Photo image={media} sizes="(min-width: 900px) 45vw, 90vw" loading="lazy" data-speed="0.9" />
          )}
        </figure>
      </div>
    </section>
  );
}
