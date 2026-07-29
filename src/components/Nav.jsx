import { useRef, useState } from 'react';
import { gsap, useGSAP, ScrollTrigger, prefersReducedMotion } from '../lib/gsap';
import Logo from './Logo';
import { menu } from '../data/menu';

const LINKS = [
  { id: '#story', label: 'Our Story', index: '01' },
  { id: '#menu', label: 'The Menu', index: '02' },
  { id: '#gallery', label: 'Gallery', index: '03' },
  { id: '#visit', label: 'Visit Us', index: '04' },
];

export default function Nav({ onNavigate }) {
  const root = useRef(null);
  const panel = useRef(null);
  const openTl = useRef(null);
  const [open, setOpen] = useState(false);

  useGSAP(
    () => {
      /* --- Bar: solid once we leave the hero, hidden while scrolling down --- */
      gsap.set('.nav__bar', { yPercent: 0 });

      ScrollTrigger.create({
        start: 'top -80',
        end: 99999,
        toggleClass: { targets: '.nav', className: 'nav--stuck' },
      });

      const showHide = gsap.to('.nav__bar', {
        yPercent: -140,
        duration: 0.45,
        ease: 'power2.inOut',
        paused: true,
      });

      ScrollTrigger.create({
        start: 'top -260',
        end: 99999,
        onUpdate: (self) => {
          /* Never hide the bar while the overlay menu is open. */
          if (document.body.classList.contains('menu-open')) return showHide.reverse();
          self.direction === 1 ? showHide.play() : showHide.reverse();
        },
      });

      /* --- Overlay menu timeline, built once and replayed --- */
      const tl = gsap.timeline({ paused: true });

      tl.set(panel.current, { autoAlpha: 1, pointerEvents: 'auto' })
        .fromTo(
          '.nav__panel-bg',
          { yPercent: -101 },
          { yPercent: 0, duration: 0.7, ease: 'solis' }
        )
        .fromTo(
          '.nav__link-inner',
          { yPercent: 115, rotate: 4 },
          { yPercent: 0, rotate: 0, duration: 0.75, ease: 'solis', stagger: 0.07 },
          '-=0.35'
        )
        .fromTo(
          '.nav__meta > *',
          { y: 24, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.6, ease: 'solis', stagger: 0.08 },
          '-=0.45'
        )
        .fromTo(
          '.nav__sun',
          { scale: 0.4, opacity: 0, rotate: -60 },
          { scale: 1, opacity: 0.16, rotate: 0, duration: 1, ease: 'solis' },
          '-=0.8'
        );

      openTl.current = tl;
    },
    { scope: root }
  );

  const toggle = (next) => {
    const willOpen = next ?? !open;
    setOpen(willOpen);
    document.body.classList.toggle('menu-open', willOpen);

    if (prefersReducedMotion()) {
      gsap.set(panel.current, { autoAlpha: willOpen ? 1 : 0, pointerEvents: willOpen ? 'auto' : 'none' });
      return;
    }

    const tl = openTl.current;
    if (!tl) return;
    /* Closing runs the same timeline backwards, a little faster. The opening
       `set()` at time 0 reverts last, so the panel only disappears once the
       curtain has finished sliding out. */
    tl.timeScale(willOpen ? 1 : 1.7)[willOpen ? 'play' : 'reverse']();
  };

  const go = (id) => {
    toggle(false);
    /* Let the overlay start clearing before the page moves. */
    gsap.delayedCall(0.35, () => onNavigate?.(id));
  };

  return (
    <div className="nav" ref={root}>
      <div className="nav__bar">
        <a
          className="nav__brand"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.('#top');
          }}
          aria-label="Solis — back to top"
        >
          <Logo withWordmark={false} className="nav__logo" />
          <span className="nav__brandname">Solis</span>
        </a>

        <div className="nav__right">
          <a className="nav__cta" href="#menu" onClick={(e) => { e.preventDefault(); onNavigate?.('#menu'); }}>
            Menu
          </a>

          <button
            className={`nav__toggle ${open ? 'is-open' : ''}`}
            onClick={() => toggle()}
            aria-expanded={open}
            aria-controls="nav-panel"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span className="nav__toggle-line" />
            <span className="nav__toggle-line" />
          </button>
        </div>
      </div>

      <div className="nav__panel" id="nav-panel" ref={panel} aria-hidden={!open}>
        <div className="nav__panel-bg" />

        <svg className="nav__sun" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="46" fill="var(--sun)" opacity="0.9" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 24;
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * 58}
                y1={100 + Math.sin(a) * 58}
                x2={100 + Math.cos(a) * 74}
                y2={100 + Math.sin(a) * 74}
                stroke="var(--sun)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.55"
              />
            );
          })}
        </svg>

        <nav className="nav__links">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={link.id}
              className="nav__link"
              onClick={(e) => {
                e.preventDefault();
                go(link.id);
              }}
              tabIndex={open ? 0 : -1}
            >
              <span className="nav__link-inner">
                <span className="nav__link-index">{link.index}</span>
                {link.label}
              </span>
            </a>
          ))}
        </nav>

        <div className="nav__meta">
          <div>
            <span className="nav__meta-label">Open daily</span>
            <p>07:00 — 01:00</p>
          </div>
          <div>
            <span className="nav__meta-label">On the menu</span>
            <p>{menu.length} sections</p>
          </div>
          <div>
            <span className="nav__meta-label">Say hello</span>
            <p>hello@solis.cafe</p>
          </div>
        </div>
      </div>
    </div>
  );
}
