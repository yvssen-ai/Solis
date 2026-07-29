import { useRef } from 'react';
import { gsap, useGSAP, splitLines, prefersReducedMotion } from '../lib/gsap';
import { img } from '../data/images';
import { menu, totalItems } from '../data/menu';
import Photo from './Photo';

const STATS = [
  { value: 4, suffix: 'AM', label: 'The ovens go on' },
  { value: 72, suffix: 'h', label: 'Cold ferment on our dough' },
  { value: menu.length, suffix: '', label: 'Sections on the menu' },
  { value: totalItems, suffix: '', label: 'Things to order' },
];

export default function Story() {
  const root = useRef(null);
  const primary = img(1); // the tagline wall inside
  const secondary = img(3); // the cortado corner

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from('.story__text [data-reveal], .story__signature', {
        y: 26,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'solis',
        stagger: 0.12,
        scrollTrigger: { trigger: '.story__text', start: 'top 85%' },
      });

      /* ---- Headline: masked lines, staggered up ---- */
      const split = splitLines('.story__title');
      gsap.from(split.lines, {
        yPercent: 115,
        duration: 1.1,
        ease: 'solis',
        stagger: 0.09,
        scrollTrigger: { trigger: '.story__title', start: 'top 85%' },
      });

      const copySplit = splitLines('.story__copy p');
      gsap.from(copySplit.lines, {
        yPercent: 100,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'solis',
        stagger: 0.045,
        scrollTrigger: { trigger: '.story__copy', start: 'top 82%' },
      });

      /* ---- Images: clip-path wipe, then a slow inner drift ---- */
      gsap.utils.toArray('.story__frame').forEach((frame, i) => {
        gsap.fromTo(
          frame,
          { clipPath: 'inset(0% 0% 100% 0%)' },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            duration: 1.4,
            ease: 'solis',
            scrollTrigger: { trigger: frame, start: 'top 88%' },
          }
        );

        gsap.fromTo(
          frame.querySelector('img'),
          { scale: 1.3 },
          {
            scale: 1,
            duration: 1.6,
            ease: 'solis',
            scrollTrigger: { trigger: frame, start: 'top 88%' },
          }
        );

        gsap.to(frame.querySelector('img'), {
          yPercent: i === 0 ? -9 : 9,
          ease: 'none',
          scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      /* ---- Stats: count up once, then hold ---- */
      gsap.utils.toArray('.stat').forEach((stat) => {
        const numberEl = stat.querySelector('.stat__value');
        const target = Number(numberEl.dataset.value);
        const obj = { v: 0 };

        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: stat, start: 'top 90%', once: true },
          onUpdate: () => {
            numberEl.textContent = String(Math.round(obj.v));
          },
        });

        gsap.from(stat, {
          y: 40,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'solis',
          scrollTrigger: { trigger: stat, start: 'top 92%' },
        });
      });

      /* ---- A thin sunbeam that draws itself down the section ---- */
      gsap.fromTo(
        '.story__beam',
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: { trigger: root.current, start: 'top 70%', end: 'bottom 80%', scrub: 0.5 },
        }
      );
    },
    { scope: root }
  );

  return (
    <section className="section section--light story" id="story" ref={root}>
      <span className="story__beam" aria-hidden="true" />

      <div className="shell story__grid">
        <div className="story__text">
          <p className="eyebrow" data-reveal>
            Our story
          </p>

          <h2 className="story__title">
            We named it after the sun, then built the day around it.
          </h2>

          <div className="story__copy">
            <p>Dough rests three days, the ovens go on at four, and nothing sits.</p>
          </div>

          <div className="story__signature">
            <span>— the Solis bakers</span>
          </div>
        </div>

        <div className="story__media">
          <figure className="story__frame story__frame--tall" data-speed="0.92">
            {primary && <Photo image={primary} sizes="(min-width: 900px) 25vw, 45vw" loading="lazy" />}
          </figure>
          <figure className="story__frame story__frame--short" data-speed="1.08">
            {secondary && <Photo image={secondary} sizes="(min-width: 900px) 25vw, 45vw" loading="lazy" />}
          </figure>
        </div>
      </div>

      <div className="shell">
        <dl className="stats">
          {STATS.map((stat) => (
            <div className="stat" key={stat.label}>
              <dt className="stat__number">
                <span className="stat__value" data-value={stat.value}>
                  0
                </span>
                <span className="stat__suffix">{stat.suffix}</span>
              </dt>
              <dd className="stat__label">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
