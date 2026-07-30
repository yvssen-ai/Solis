import { useRef } from 'react';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/gsap';
import { formatPiastres } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { CURRENCY } from '../data/menu';

/**
 * The floating cart button.
 *
 * A pill above the bottom edge rather than an icon in the nav bar: the nav bar
 * hides itself on scroll down, and the one control a customer needs constantly
 * while reading an 83-item menu should not disappear with it. It stays out of
 * the way entirely until the cart has something in it.
 */
export default function CartFab() {
  const el = useRef(null);
  const { count, subtotalPiastres, open, isOpen } = useCart();
  const visible = count > 0;

  /* Park it off the bottom edge. Declared first so it runs before the effect
     below on mount, and stated in yPercent so GSAP owns the unit — see the note
     in shop.css about why this cannot live in the stylesheet. */
  useGSAP(() => {
    gsap.set(el.current, { yPercent: 120, opacity: 0 });
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set(el.current, { opacity: visible ? 1 : 0, yPercent: visible ? 0 : 120 });
        return;
      }

      gsap.to(el.current, {
        opacity: visible ? 1 : 0,
        yPercent: visible ? 0 : 120,
        duration: 0.5,
        ease: visible ? 'back.out(1.6)' : 'power3.in',
        overwrite: true,
      });
    },
    { dependencies: [visible] }
  );

  /* A small kick each time the count changes, so adding a fifth coffee to an
     already-open cart still registers as having done something. */
  useGSAP(
    () => {
      if (!visible || prefersReducedMotion()) return;
      gsap.fromTo(
        '.cart-fab__count',
        { scale: 1.45 },
        { scale: 1, duration: 0.45, ease: 'back.out(3)' }
      );
    },
    { dependencies: [count], scope: el }
  );

  return (
    <button
      type="button"
      ref={el}
      className={`cart-fab ${visible ? 'is-visible' : ''}`}
      onClick={open}
      aria-hidden={!visible}
      tabIndex={visible && !isOpen ? 0 : -1}
    >
      <span className="cart-fab__count">{count}</span>
      <span>
        {CURRENCY} {formatPiastres(subtotalPiastres)}
      </span>
      <span className="sr-only">— open your cart</span>
    </button>
  );
}
