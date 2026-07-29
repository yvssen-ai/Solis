import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';
import { img } from '../data/images';
import { CURRENCY, formatPrice } from '../data/menu';
import Photo from './Photo';

/**
 * `image` indexes into the gallery (see src/data/images.js) so every card shows
 * the photograph that actually belongs to it rather than whatever came next.
 */
const PICKS = [
  {
    name: 'Sausage Egg',
    price: 265,
    kind: 'Breakfast',
    image: 2,
    blurb: 'Eggs over toast, sausage, a bright salad on the side. Best eaten in the sun.',
  },
  {
    name: 'Ice Matcha',
    price: 160,
    kind: 'Signature',
    image: 4,
    blurb: 'Japanese ceremonial grade, whisked thin and poured straight over ice.',
  },
  {
    name: 'Ice Spanish Latte',
    price: 160,
    kind: 'Ice Coffee',
    image: 3,
    blurb: 'Sweetened condensed milk, double shot, built cold. Our most ordered cup.',
  },
  {
    name: 'Egg Benedict Smoked Salmon',
    price: 385,
    kind: 'Breakfast',
    image: 5,
    blurb: 'Everything on this plate was assembled after you ordered it.',
  },
  {
    name: 'Colombia Infused Peach',
    price: 1450,
    kind: 'Retail — 250g',
    image: 6,
    blurb: 'Our loudest lot. Co-fermented with peach, and it does not whisper about it.',
  },
  {
    name: 'Sun Set',
    price: 265,
    kind: 'Signature',
    image: 7,
    blurb: 'The one we named the place for. Order it late and take the corner table.',
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
      /* Measured off the section itself, which is sized in `svh` and therefore
         does not change when a phone's address bar collapses. `window.innerHeight`
         does change, and using it here made the pin's length move mid-scroll. */
      const tail = () => root.current.offsetHeight * 0.5;

      /* Vertical scroll drives horizontal travel. ease MUST be "none" so the
         two stay locked 1:1 — see containerAnimation below. */
      const scrollTween = gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          pin: true,
          /* Direct scrub on touch. A numeric scrub keeps easing toward the
             scroll position after your finger stops, and against native
             momentum that reads as the rail wobbling. */
          scrub: isTouch ? true : 1,
          start: 'top top',
          end: () => `+=${distance() + tail()}`,
          invalidateOnRefresh: true,
          /* No anticipatePin: it pre-pins a few pixels early, which with scrub
             shows up as a nudge at the moment the section sticks. */
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
            end: () => `+=${distance() + tail()}`,
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
            const image = img(pick.image);
            return (
              <article className="pick" key={pick.name}>
                <div className="pick__media">
                  {image && (
                    <Photo
                      image={image}
                      className="pick__img"
                      sizes="(min-width: 760px) 340px, 74vw"
                      alt={pick.name}
                      loading="lazy"
                    />
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
