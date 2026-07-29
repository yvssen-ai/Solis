import { useRef, useState } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';
import { gallery } from '../data/images';
import Photo from './Photo';

/**
 * Every third tile runs double width, so each group of three fills its rows
 * exactly. The final tile is widened too when it would otherwise be stranded
 * alone next to a gap — that keeps the grid whole for any number of photos.
 */
const isWide = (i, total) => i % 3 === 0 || (i === total - 1 && i % 3 === 1);

export default function Gallery() {
  const root = useRef(null);
  const lightbox = useRef(null);
  const originRect = useRef(null);
  const [openIndex, setOpenIndex] = useState(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      /* Batched reveals: everything that enters within the same frame animates
         together with a stagger, rather than each tile firing on its own. */
      ScrollTrigger.batch('.tile', {
        start: 'top 90%',
        onEnter: (batch) =>
          gsap.to(batch, {
            y: 0,
            autoAlpha: 1,
            duration: 1,
            ease: 'solis',
            stagger: 0.09,
            overwrite: true,
          }),
        onLeaveBack: (batch) =>
          gsap.set(batch, { y: 60, autoAlpha: 0, overwrite: true }),
      });

      gsap.set('.tile', { y: 60, autoAlpha: 0 });

      /* Each tile's image drifts at its own rate inside its frame. */
      gsap.utils.toArray('.tile').forEach((tile, i) => {
        gsap.fromTo(
          tile.querySelector('img'),
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: 'none',
            scrollTrigger: {
              trigger: tile,
              start: 'top bottom',
              end: 'bottom top',
              scrub: i % 2 ? 1 : 0.5,
            },
          }
        );
      });

      gsap.from('.gallery__title', {
        yPercent: 30,
        autoAlpha: 0,
        duration: 1,
        ease: 'solis',
        scrollTrigger: { trigger: '.gallery__head', start: 'top 85%' },
      });
    },
    { scope: root }
  );

  /* ---- Manual FLIP: grow the tapped tile into a full-screen viewer ---- */
  useGSAP(
    () => {
      if (openIndex === null || !lightbox.current) return;

      const figure = lightbox.current.querySelector('.lightbox__figure');
      const from = originRect.current;

      gsap.set(lightbox.current, { autoAlpha: 1, pointerEvents: 'auto' });
      gsap.fromTo(
        lightbox.current.querySelector('.lightbox__scrim'),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.45, ease: 'power2.out' }
      );

      if (from && !prefersReducedMotion()) {
        const to = figure.getBoundingClientRect();
        gsap.fromTo(
          figure,
          {
            x: from.left - to.left,
            y: from.top - to.top,
            scaleX: from.width / to.width,
            scaleY: from.height / to.height,
            transformOrigin: 'top left',
          },
          { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.8, ease: 'solis' }
        );
      }

      gsap.fromTo(
        '.lightbox__caption',
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, ease: 'solis', delay: 0.25 }
      );
    },
    { dependencies: [openIndex], scope: root }
  );

  const open = (event, index) => {
    originRect.current = event.currentTarget.getBoundingClientRect();
    setOpenIndex(index);
    document.body.classList.add('menu-open');
  };

  const close = () => {
    document.body.classList.remove('menu-open');
    if (!lightbox.current) return setOpenIndex(null);
    gsap.to(lightbox.current, {
      autoAlpha: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => setOpenIndex(null),
    });
  };

  const current = openIndex !== null ? gallery[openIndex] : null;

  return (
    <section className="section gallery" id="gallery" ref={root}>
      <div className="shell gallery__head">
        <p className="eyebrow">Gallery</p>
        <h2 className="gallery__title">The room, the light, the bake.</h2>
      </div>

      <div className="shell">
        <div className="gallery__grid">
          {gallery.map((image, i) => (
            <button
              className={`tile ${isWide(i, gallery.length) ? 'tile--wide' : ''}`}
              key={image.id}
              onClick={(e) => open(e, i)}
              aria-label={`View ${image.caption}`}
            >
              <Photo
                image={image}
                sizes={
                  isWide(i, gallery.length)
                    ? '(min-width: 760px) 50vw, 100vw'
                    : '(min-width: 760px) 25vw, 50vw'
                }
                loading="lazy"
              />
              <span className="tile__index">{String(i + 1).padStart(2, '0')}</span>
              <span className="tile__caption">{image.caption}</span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="lightbox" ref={lightbox} onClick={close} role="dialog" aria-modal="true">
          <div className="lightbox__scrim" />
          <button className="lightbox__close" onClick={close} aria-label="Close image">
            <span />
            <span />
          </button>
          <figure className="lightbox__figure" onClick={(e) => e.stopPropagation()}>
            <img src={current.src} alt={current.alt} />
            <figcaption className="lightbox__caption">{current.caption}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
