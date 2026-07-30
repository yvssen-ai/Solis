import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, ScrollSmoother, prefersReducedMotion } from '../lib/gsap';
import { rpc, formatPiastres, friendlyError, startCardPayment } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { rememberToken } from '../lib/orderTokens';
import { CURRENCY } from '../data/menu';
import OrderHistory from './OrderHistory';

/**
 * Cart, checkout and order history — one panel, three views.
 *
 * A single drawer rather than a page per step: on a phone the whole flow is
 * three thumb-reach taps from the menu, and the customer never loses their place
 * in the list they were reading.
 *
 * No account, and no step that asks for one. Checkout collects a name and a
 * phone number, which is what the counter needs to hand the order over; what
 * comes back is a receipt token kept on the device so the order can still be
 * followed afterwards.
 */
export default function CartDrawer() {
  const { lines, count, subtotalPiastres, isOpen, close, setQuantity, remove, clear, toPayload } =
    useCart();

  const root = useRef(null);
  const sheet = useRef(null);
  const [view, setView] = useState('cart');
  const [placed, setPlaced] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    fulfilment: 'pickup',
    address: '',
    notes: '',
    payment: 'cash',
  });

  /* ---- Open / close ----------------------------------------------------- */

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();

      if (isOpen) {
        gsap.set(root.current, { autoAlpha: 1, pointerEvents: 'auto' });
        if (reduced) {
          gsap.set(sheet.current, { xPercent: 0 });
          gsap.set('.shop__scrim', { opacity: 1 });
          return;
        }
        gsap
          .timeline()
          .fromTo('.shop__scrim', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' })
          .fromTo(
            sheet.current,
            { xPercent: 100 },
            { xPercent: 0, duration: 0.62, ease: 'solis' },
            0
          )
          .fromTo(
            '.shop__stagger',
            { y: 18, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.45, ease: 'solis', stagger: 0.05 },
            0.18
          );
        return;
      }

      /* Closed: slide out, then stop taking pointer events. */
      if (reduced) {
        gsap.set(root.current, { autoAlpha: 0, pointerEvents: 'none' });
        return;
      }
      gsap
        .timeline({
          onComplete: () => gsap.set(root.current, { autoAlpha: 0, pointerEvents: 'none' }),
        })
        .to(sheet.current, { xPercent: 100, duration: 0.42, ease: 'power3.in' })
        .to('.shop__scrim', { opacity: 0, duration: 0.42 }, 0);
    },
    { dependencies: [isOpen, view], scope: root }
  );

  /**
   * Stop the page moving behind an open drawer.
   *
   * Deliberately not `overflow: hidden` on the body, the usual approach. With
   * ScrollSmoother running, the document's height comes from a spacer it
   * maintains; collapsing that mid-scroll resets scrollTop, so the page would
   * jump to the top on open and stay there on close. And on iOS, `overflow:
   * hidden` plus a fixed height does the same thing on its own.
   *
   * Nothing here changes layout:
   *   - the smoother, when there is one, is simply paused;
   *   - the scrim carries `touch-action: none`, which stops a touch drag that
   *     starts on it from scrolling the page;
   *   - wheel events over the scrim are cancelled, for pointer devices with no
   *     smoother (reduced motion).
   *
   * The sheet's own `overscroll-behavior: contain` keeps its internal scroll
   * from chaining out to the page once it hits an end.
   */
  useEffect(() => {
    document.body.classList.toggle('cart-open', isOpen);
    if (!isOpen) return;

    const smoother = ScrollSmoother.get();
    smoother?.paused(true);

    /* Must be non-passive to be allowed to cancel the scroll. */
    const stop = (event) => event.preventDefault();
    const scrim = root.current?.querySelector('.shop__scrim');
    scrim?.addEventListener('wheel', stop, { passive: false });

    return () => {
      smoother?.paused(false);
      scrim?.removeEventListener('wheel', stop);
      document.body.classList.remove('cart-open');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  /* Reopening after a completed order should show a cart, not last week's
     receipt. */
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (placed) {
      setPlaced(null);
      setView('cart');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Checkout --------------------------------------------------------- */

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    try {
      /* Only ids and quantities go over the wire. The function reads every price
         from menu_items, so the total below is a preview, not an input. */
      const order = await rpc('place_order', {
        p_items: toPayload(),
        p_customer_name: form.name,
        p_customer_phone: form.phone,
        p_fulfilment: form.fulfilment,
        p_address: form.fulfilment === 'delivery' ? form.address : null,
        p_notes: form.notes || null,
      });

      /* The receipt token is the only thing that can retrieve this order later.
         Store it before anything else touches state — if the drawer closed or
         the tab died right here, the order would otherwise be untrackable. */
      rememberToken(order?.public_token);

      /* Paying by card leaves the site. The order already exists and is already
         tracked, so a customer who abandons the card page still has an order the
         counter can see — unpaid, which is the truth. */
      if (form.payment === 'card') {
        const checkoutUrl = await startCardPayment(order.id, order.public_token);
        clear();
        window.location.assign(checkoutUrl);
        return; // leaving; do not fall through to the receipt view
      }

      setPlaced(order);
      clear();
      setView('done');
    } catch (failure) {
      setError(friendlyError(failure, 'The order did not go through. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    lines.length > 0 &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    (form.fulfilment !== 'delivery' || form.address.trim().length > 0);

  /* ---- Views ------------------------------------------------------------ */

  const cartView = (
    <>
      {lines.length === 0 ? (
        <p className="shop__muted shop__stagger">
          Your cart is empty. Add something from the menu.
        </p>
      ) : (
        <ul className="shop__lines">
          {lines.map((line) => (
            <li className="shop__line shop__stagger" key={line.id}>
              <div className="shop__line-text">
                <span className="shop__line-name">
                  {line.name}
                  {line.meta && <span className="shop__line-meta">{line.meta}</span>}
                </span>
                <span className="shop__line-unit">
                  {CURRENCY} {formatPiastres(line.pricePiastres)} each
                </span>
              </div>

              <div className="shop__stepper">
                <button
                  type="button"
                  onClick={() => setQuantity(line.id, line.quantity - 1)}
                  aria-label={`One less ${line.name}`}
                >
                  −
                </button>
                <span aria-live="polite">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(line.id, line.quantity + 1)}
                  aria-label={`One more ${line.name}`}
                >
                  +
                </button>
              </div>

              <span className="shop__line-total">
                {CURRENCY} {formatPiastres(line.pricePiastres * line.quantity)}
              </span>

              <button
                className="shop__line-remove"
                type="button"
                onClick={() => remove(line.id)}
                aria-label={`Remove ${line.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <div className="shop__foot shop__stagger">
          <p className="shop__subtotal">
            <span>Subtotal</span>
            <strong>
              {CURRENCY} {formatPiastres(subtotalPiastres)}
            </strong>
          </p>
          <button
            className="shop__btn shop__btn--primary"
            type="button"
            onClick={() => setView('checkout')}
          >
            Checkout
          </button>
        </div>
      )}
    </>
  );

  const checkoutView = (
    <form className="shop__form shop__stagger" onSubmit={submit}>
      <label className="shop__label" htmlFor="solis-name">
        Name for the order
      </label>
      <input
        id="solis-name"
        className="shop__input"
        required
        autoComplete="name"
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />

      <label className="shop__label" htmlFor="solis-phone">
        Phone <span className="shop__optional">so we can call you</span>
      </label>
      <input
        id="solis-phone"
        className="shop__input"
        type="tel"
        inputMode="tel"
        required
        autoComplete="tel"
        placeholder="01x xxxx xxxx"
        value={form.phone}
        onChange={(event) => setForm({ ...form, phone: event.target.value })}
      />

      <fieldset className="shop__choice">
        <legend className="shop__label">How are you getting it?</legend>
        {[
          { value: 'pickup', label: 'Pickup' },
          { value: 'delivery', label: 'Delivery' },
        ].map((option) => (
          <label key={option.value} className="shop__radio">
            <input
              type="radio"
              name="fulfilment"
              value={option.value}
              checked={form.fulfilment === option.value}
              onChange={() => setForm({ ...form, fulfilment: option.value })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="shop__choice">
        <legend className="shop__label">How are you paying?</legend>
        {[
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
        ].map((option) => (
          <label key={option.value} className="shop__radio">
            <input
              type="radio"
              name="payment"
              value={option.value}
              checked={form.payment === option.value}
              onChange={() => setForm({ ...form, payment: option.value })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      {form.payment === 'card' && (
        <p className="shop__muted shop__note">
          You'll be taken to our payment provider to enter your card, then brought
          back here. Visa, Mastercard and Meeza.
        </p>
      )}

      {form.fulfilment === 'delivery' && (
        <>
          <label className="shop__label" htmlFor="solis-address">
            Address
          </label>
          <textarea
            id="solis-address"
            className="shop__input"
            rows={2}
            required
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </>
      )}

      <label className="shop__label" htmlFor="solis-notes">
        Anything we should know? <span className="shop__optional">optional</span>
      </label>
      <textarea
        id="solis-notes"
        className="shop__input"
        rows={2}
        placeholder="Oat milk, extra shot, no sugar…"
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />

      <p className="shop__subtotal">
        <span>Total</span>
        <strong>
          {CURRENCY} {formatPiastres(subtotalPiastres)}
        </strong>
      </p>

      <button
        className="shop__btn shop__btn--primary"
        type="submit"
        disabled={busy || !canSubmit}
      >
        {busy
          ? form.payment === 'card'
            ? 'Taking you to payment…'
            : 'Sending…'
          : form.payment === 'card'
            ? `Pay ${CURRENCY} ${formatPiastres(subtotalPiastres)} by card`
            : 'Place order'}
      </button>

      <p className="shop__hint">
        {form.payment === 'card'
          ? 'Your card is entered on our payment provider’s page — it never touches this site.'
          : 'Pay when you collect — cash, card or Vodafone Cash at the counter.'}
      </p>

      {error && (
        <p className="shop__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );

  const doneView = (
    <div className="shop__done shop__stagger">
      <p className="shop__done-number">{placed?.order_number}</p>
      <h3 className="shop__done-title">The counter has it.</h3>
      <p className="shop__muted">
        {placed?.fulfilment === 'delivery'
          ? 'We will call the number you gave us when the rider is on the way.'
          : 'We will have it ready — give your order number at the counter.'}
      </p>
      <p className="shop__done-total">
        {CURRENCY} {formatPiastres(placed?.total_piastres ?? 0)}
      </p>
      <button className="shop__btn shop__btn--quiet" type="button" onClick={() => setView('orders')}>
        Track it
      </button>
    </div>
  );

  const TABS = [
    { id: 'cart', label: count > 0 ? `Cart (${count})` : 'Cart' },
    { id: 'orders', label: 'My orders' },
  ];

  return (
    <div className="shop" ref={root} aria-hidden={!isOpen}>
      <div className="shop__scrim" onClick={close} />

      <aside
        className="shop__sheet"
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
      >
        <header className="shop__head">
          <div className="shop__tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`shop__tab ${view === tab.id ? 'is-active' : ''}`}
                onClick={() => setView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button className="shop__close" type="button" onClick={close} aria-label="Close">
            <span />
            <span />
          </button>
        </header>

        {view === 'checkout' && (
          <button className="shop__back" type="button" onClick={() => setView('cart')}>
            ← Back to cart
          </button>
        )}

        <div className="shop__body">
          {view === 'cart' && cartView}
          {view === 'checkout' && checkoutView}
          {view === 'done' && doneView}
          {view === 'orders' && <OrderHistory />}
        </div>
      </aside>
    </div>
  );
}
