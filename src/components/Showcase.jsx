import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';
import { img } from '../data/images';
import { CURRENCY, formatPrice } from '../data/menu';

const PICKS = [
  {
    name: 'Sun Set',
    price: 265,
    kind: 'Signature',
    blurb: 'The one we named the place for. Layered, citrus-forward, poured over a slow-melt sphere.',
  },
  {
    name: 'Blended Pistachio Matcha',
    price: 265,
    kind: 'Signature',
    blurb: 'Ceremonial matcha spun with roasted pistachio until it turns to velvet.',
  },
  {
    name: 'Banoffee Latte',
    price: 245,
    kind: 'Signature',
    blurb: 'Banana, burnt caramel, double shot. Dessert that still tastes like coffee.',
  },
  {
    name: 'Roast Beef Croissant',
    price: 385,
    kind: 'Bakery',
    blurb: 'Seventy-two hour dough, slow-roasted beef, sharp mustard butter.',
  },
  {
    name: 'Cherry Matcha Cloud',
    price: 235,
    kind: 'Matcha',
    blurb: 'Whisked thin, capped with cherry cream that collapses into it as you drink.',
  },
  {
    name: 'Colombia Infused Peach',
    price: 1450,
    kind: 'Retail — 250g',
    blurb: 'Our loudest lot. Co-fermented with peach, and it does not whisper about it.',
  },
];

export default function Showcase() {
  const root = useRef(null);
  const track = useRef(null);

  useGSAP(
    () => {
      const isTouch = window.matchMedia('(hover: none)').matches;

      /* On reduced motion the track becomes an ordinary swipeable rail. */
      if (prefersReducedMotion()) {
        root.current.classList.add('showcase--static');
        return;
      }

      const el = track.current;
      const distance = () => Math.max(0, el.scrollWidth - root.current.offsetWidth);

      /* Vertical scroll drives horizontal travel. ease MUST be "none" so the
         two stay locked 1:1 — see containerAnimation below. */
      const scrollTween = gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          pin: true,
          scrub: isTouch ? 0.35 : 1,
          start: 'top top',
          end: () => `+=${distance() + window.innerHeight * 0.5}`,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      /* Cards react to their own horizontal position, not to page scroll. */
      gsap.utils.toArray('.pick').forEach((card) => {
        gsap.fromTo(
          card.querySelector('.pick__img'),
          { xPercent: -12, scale: 1.22 },
          {
            xPercent: 12,
            scale: 1.22,
            ease: 'none',
            scrollTrigger: {
              trigger: card,
              containerAnimation: scrollTween,
              start: 'left right',
              end: 'right left',
              scrub: true,
            },
          }
        );

        gsap.fromTo(
          card.querySelectorAll('.pick__reveal'),
          { y: 34, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.7,
            ease: 'solis',
            stagger: 0.06,
            scrollTrigger: {
              trigger: card,
              containerAnimation: scrollTween,
              start: 'left 88%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });

      /* Progress rail under the pinned panel */
      gsap.fromTo(
        '.showcase__progress-fill',
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          transformOrigin: 'left center',
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: () => `+=${distance() + window.innerHeight * 0.5}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );

      ScrollTrigger.refresh();
    },
    { scope: root }
  );

  return (
    <section className="showcase" ref={root} aria-label="Signature drinks and bakes">
      <div className="showcase__head shell">
        <p className="eyebrow">House favourites</p>
        <h2 className="showcase__title">Six things worth the trip</h2>
      </div>

      <div className="showcase__viewport">
        <div className="showcase__track" ref={track}>
          {PICKS.map((pick, i) => {
            const image = img(i + 1);
            return (
              <article className="pick" key={pick.name}>
                <div className="pick__media">
                  {image && (
                    <img className="pick__img" src={image.src} alt={pick.name} loading="lazy" />
                  )}
                  <span className="pick__index">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="pick__body">
                  <p className="pick__kind pick__reveal">{pick.kind}</p>
                  <h3 className="pick__name pick__reveal">{pick.name}</h3>
                  <p className="pick__blurb pick__reveal">{pick.blurb}</p>
                  <p className="pick__price pick__reveal">
                    {CURRENCY} {formatPrice(pick.price)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="showcase__progress shell">
        <span className="showcase__progress-rail">
          <span className="showcase__progress-fill" />
        </span>
        <span className="showcase__hint">Keep scrolling</span>
      </div>
    </section>
  );
}
