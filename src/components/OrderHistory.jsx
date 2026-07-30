import { useCallback, useEffect, useState } from 'react';
import { rpc, formatPiastres, friendlyError } from '../lib/supabase';
import { readTokens } from '../lib/orderTokens';
import { CURRENCY } from '../data/menu';

const STATUS_LABEL = {
  pending: 'Sent to the counter',
  confirmed: 'Confirmed',
  preparing: 'Being made',
  ready: 'Ready for you',
  completed: 'Collected',
  cancelled: 'Cancelled',
};

/* Anything past this is finished and will not change again. */
const SETTLED = new Set(['completed', 'cancelled']);

/** How often to re-check while the customer is watching. */
const POLL_MS = 20000;

/**
 * Orders placed from this device, newest first.
 *
 * Looked up by the receipt tokens in localStorage rather than by who is signed
 * in — there is no signing in. `get_orders` is SECURITY DEFINER and returns only
 * the rows whose token was presented, so that is the whole authorization story.
 *
 * Status is polled rather than pushed. Realtime meant holding a websocket open,
 * which was affordable while the SDK was already loaded for auth; with it gone,
 * a 20-second poll costs a fraction of the same thing, runs only while the panel
 * is open, and stops once every order has settled.
 */
export default function OrderHistory() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  /* A stable dependency: the array identity changes on every render, the joined
     string only when the tokens actually do. */
  const tokenKey = readTokens().join(',');

  const load = useCallback(async () => {
    if (!tokenKey) {
      setOrders([]);
      return;
    }
    try {
      const data = await rpc('get_orders', { p_tokens: tokenKey.split(',') });
      setError(null);
      setOrders(Array.isArray(data) ? data : []);
    } catch (failure) {
      setError(friendlyError(failure, 'Could not check your orders just now.'));
      setOrders((current) => current ?? []);
    }
  }, [tokenKey]);

  useEffect(() => {
    load();
  }, [load]);

  /* Keep checking only while something can still change. A collected order is
     not going to move again, and a tab left open on the counter should not poll
     all afternoon. */
  useEffect(() => {
    if (!orders?.length) return;
    if (orders.every((order) => SETTLED.has(order.status))) return;

    const timer = setInterval(load, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orders, load]);

  if (orders === null) return <p className="shop__muted">Checking your orders…</p>;

  if (!orders.length) {
    return (
      <div>
        <p className="shop__muted">
          {error
            ? 'Could not reach the counter just now.'
            : 'Nothing here yet. Orders you place appear here so you can follow them.'}
        </p>
        {error && (
          <p className="shop__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <ul className="shop__orders">
        {orders.map((order) => (
          <li className="shop__order" key={order.order_number}>
            <header className="shop__order-head">
              <span className="shop__order-number">{order.order_number}</span>
              <span className={`shop__status shop__status--${order.status}`}>
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
            </header>

            <p className="shop__order-meta">
              {new Date(order.created_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' · '}
              {order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}
            </p>

            <ul className="shop__order-lines">
              {order.items.map((line) => (
                <li key={line.name}>
                  <span className="shop__order-qty">{line.quantity}×</span>
                  {line.name}
                  <span className="shop__order-line-total">
                    {CURRENCY} {formatPiastres(line.line_total_piastres)}
                  </span>
                </li>
              ))}
            </ul>

            {order.notes && <p className="shop__order-note">“{order.notes}”</p>}

            <p className="shop__order-total">
              Total{' '}
              <strong>
                {CURRENCY} {formatPiastres(order.total_piastres)}
              </strong>
            </p>
          </li>
        ))}
      </ul>

      <p className="shop__hint">Kept on this device — give your order number at the counter.</p>
    </>
  );
}
