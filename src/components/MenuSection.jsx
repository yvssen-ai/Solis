import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, ScrollTrigger, splitLines, prefersReducedMotion } from '../lib/gsap';
import { CURRENCY, formatPrice } from '../data/menu';
import { useMenu } from '../hooks/useMenu';
import { useCart } from '../context/CartContext';

export default function MenuSection() {
  const root = useRef(null);
  const railRef = useRef(null);
  const indicatorRef = useRef(null);
  const listRef = useRef(null);
  const [active, setActive] = useState(0);
  /* Which row was tapped last, so the button can flash a confirmation. */
  const [justAdded, setJustAdded] = useState(null);

  const { sections: menu, totalItems, isLive } = useMenu();
  const { add, reconcile } = useCart();

  /* The live menu can have fewer categories than the snapshot — a category with
     nothing available in it is dropped — so an index that was valid a moment ago
     may not be after the swap. */
  const section = menu[Math.min(active, menu.length - 1)];

  /* Prune anything sold out of a cart that has been sitting in localStorage. */
  useEffect(() => {
    if (!isLive) return;
    const available = new Map();
    for (const category of menu) {
      for (const item of category.items) available.set(item.id, item);
    }
    reconcile(available);
  }, [isLive, menu, reconcile]);

  const handleAdd = (item) => {
    if (!add(item)) return;
    setJustAdded(item.id);
    /* gsap's delayedCall rather than setTimeout: it is tied to the same ticker
       as everything else here, so it pauses with the page instead of firing
       into a backgrounded tab. */
    gsap.delayedCall(0.9, () => setJustAdded((current) => (current === item.id ? null : current)));
  };

  /* ---- One-time setup: heading reveal, sticky rail behaviour ---- */
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      const split = splitLines('.menu__title');
      gsap.from(split.lines, {
        yPercent: 115,
        duration: 1.1,
        ease: 'solis',
        stagger: 0.08,
        scrollTrigger: { trigger: '.menu__head', start: 'top 82%' },
      });

      gsap.from('.menu__head [data-reveal]', {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        ease: 'solis',
        stagger: 0.1,
        scrollTrigger: { trigger: '.menu__head', start: 'top 80%' },
      });

      gsap.from('.menu__chip', {
        y: 26,
        autoAlpha: 0,
        duration: 0.6,
        ease: 'solis',
        stagger: 0.04,
        scrollTrigger: { trigger: '.menu__rail', start: 'top 92%' },
      });

      /* Rail gets a shadow once it sticks, so it separates from the list. */
      ScrollTrigger.create({
        trigger: '.menu__rail-sentinel',
        start: 'top 62px',
        end: 99999,
        toggleClass: { targets: '.menu__rail', className: 'is-stuck' },
      });
    },
    { scope: root }
  );

  /* ---- Runs on every category change ---- */
  useGSAP(
    () => {
      /* Slide the pill indicator to the active chip. */
      const rail = railRef.current;
      const chip = rail?.querySelector('.menu__chip.is-active');
      if (chip && indicatorRef.current) {
        gsap.to(indicatorRef.current, {
          x: chip.offsetLeft,
          width: chip.offsetWidth,
          duration: prefersReducedMotion() ? 0 : 0.55,
          ease: 'solis',
        });

        /* Keep the active chip in view on narrow screens. */
        const target = chip.offsetLeft - rail.clientWidth / 2 + chip.offsetWidth / 2;
        rail.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }

      if (prefersReducedMotion()) return;

      /* Items fly in from below, stagger from the top. */
      gsap.fromTo(
        '.menu__row',
        { y: 26, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.62,
          ease: 'solis',
          stagger: { each: 0.035, from: 'start' },
          overwrite: true,
        }
      );

      gsap.fromTo(
        '.menu__panel-head > *',
        { y: 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, ease: 'solis', stagger: 0.07, overwrite: true }
      );

      /* The leader dots draw across as each row appears. */
      gsap.fromTo(
        '.menu__leader',
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.8,
          ease: 'solis',
          transformOrigin: 'left center',
          stagger: { each: 0.035 },
          overwrite: true,
        }
      );

      ScrollTrigger.refresh();
    },
    /* `section` rather than `active`: the same index can point at a different
       category once the live menu replaces the snapshot, and the row animation
       has to re-run for the list that actually got rendered. */
    { scope: root, dependencies: [active, section], revertOnUpdate: true }
  );

  return (
    <section className="section menu" id="menu" ref={root}>
      <div className="shell menu__head">
        <p className="eyebrow" data-reveal>
          The menu
        </p>
        <h2 className="menu__title">Everything we make, all in one place.</h2>
        <p className="lede" data-reveal>
          {totalItems} items across {menu.length} sections. All prices in Egyptian Pounds
          (L.E).{' '}
          {isLive && <span className="menu__order-hint">Tap + on anything to start an order.</span>}
        </p>
      </div>

      <span className="menu__rail-sentinel" aria-hidden="true" />

      <div className="menu__rail-wrap">
        <div className="menu__rail" ref={railRef} role="tablist" aria-label="Menu categories">
          <span className="menu__indicator" ref={indicatorRef} aria-hidden="true" />
          {menu.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={i === active}
              aria-controls={`panel-${s.id}`}
              className={`menu__chip ${i === active ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              {s.name}
              <span className="menu__chip-count">{s.items.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="shell">
        <div
          className="menu__panel"
          id={`panel-${section.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${section.id}`}
          ref={listRef}
        >
          <header className="menu__panel-head">
            <h3 className="menu__panel-title">{section.name}</h3>
            <p className="menu__panel-tagline">{section.tagline}</p>
            <p className="menu__panel-note">{section.note}</p>
          </header>

          <ul className="menu__list">
            {section.items.map((item) => (
              <li className="menu__row" key={item.id ?? item.name}>
                <span className="menu__name">
                  {item.name}
                  {item.meta && <span className="menu__meta">{item.meta}</span>}
                  {item.signature && <span className="menu__flag">House</span>}
                </span>
                <span className="menu__leader" aria-hidden="true" />
                <span className="menu__price">
                  <span className="menu__currency">{CURRENCY}</span>
                  {formatPrice(item.price)}
                </span>
                {item.orderable && (
                  <button
                    type="button"
                    className={`menu__add ${justAdded === item.id ? 'is-added' : ''}`}
                    onClick={() => handleAdd(item)}
                    aria-label={`Add ${item.name} to your order`}
                  >
                    {justAdded === item.id ? '✓' : '+'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="shell menu__disclaimer">
        All prices are in L.E. Menu subject to seasonal change — ask the bar what landed
        this week.
      </p>

      {!isLive && (
        <p className="shell menu__offline">
          Showing our saved menu — online ordering is briefly unavailable. Everything below
          is still on sale; give us a call and we will take it over the phone.
        </p>
      )}
    </section>
  );
}
