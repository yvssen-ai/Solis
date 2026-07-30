import { useCallback, useEffect, useState } from 'react';
import { formatPiastres, friendlyError } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CURRENCY } from '../data/menu';

const STATUS_LABEL = {
  pending: 'Sent to the counter',
  confirmed: 'Confirmed',
  preparing: 'Being made',
  ready: 'Ready for you',
  completed: 'Collected',
  cancelled: 'Cancelled',
};

/**
 * Past orders, newest first.
 *
 * The select embeds order_items. There is no client-side filter by user here and
 * none is needed: the RLS policy on orders resolves to "your rows, or every row
 * if you are staff", and order_items follows its parent. Filtering in the query
 * as well would be theatre — and would quietly break the staff view.
 */
export default function OrderHistory({ isStaff }) {
  const { session, client } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!client) return;

    const { data, error: failure } = await client
      .from('orders')
      .select(
        `id, order_number, status, fulfilment, total_piastres, created_at,
         customer_name, notes,
         order_items ( id, name_snapshot, quantity, unit_price_piastres, line_total_piastres )`
      )
      .order('created_at', { ascending: false })
      .limit(20);

    if (failure) {
      setError(friendlyError(failure, 'Could not load your orders.'));
      setOrders([]);
      return;
    }
    setError(null);
    setOrders(data ?? []);
  }, [client]);

  useEffect(() => {
    load();
  }, [load, session]);

  /* Live status updates: the counter moves an order to "ready" and the customer's
     phone reflects it without a refresh. Realtime respects RLS, so a customer is
     only ever pushed their own rows. */
  useEffect(() => {
    if (!client || !session) return;

    const channel = client
      .channel('solis-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [client, session, load]);

  if (orders === null) {
    return <p className="shop__muted">Loading your orders…</p>;
  }

  if (error) {
    return (
      <p className="shop__error" role="alert">
        {error}
      </p>
    );
  }

  if (!orders.length) {
    return (
      <p className="shop__muted">
        Nothing here yet. Your orders will appear as soon as you place one.
      </p>
    );
  }

  return (
    <ul className="shop__orders">
      {orders.map((order) => (
        <li className="shop__order" key={order.id}>
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
            {isStaff && ` · ${order.customer_name}`}
          </p>

          <ul className="shop__order-lines">
            {order.order_items.map((line) => (
              <li key={line.id}>
                <span className="shop__order-qty">{line.quantity}×</span>
                {line.name_snapshot}
                <span className="shop__order-line-total">
                  {CURRENCY} {formatPiastres(line.line_total_piastres)}
                </span>
              </li>
            ))}
          </ul>

          {order.notes && <p className="shop__order-note">“{order.notes}”</p>}

          <p className="shop__order-total">
            Total <strong>{CURRENCY} {formatPiastres(order.total_piastres)}</strong>
          </p>
        </li>
      ))}
    </ul>
  );
}
