import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * The cart.
 *
 * Lines hold a snapshot of the item as it was when it went in — name, price,
 * meta — so the drawer can render without waiting on the menu, and so the total
 * on screen never changes underneath someone mid-checkout. That snapshot is for
 * display only: `place_order` re-reads every price from the database, so a cart
 * that has gone stale (or been edited in devtools) produces the right bill or no
 * order at all, never a wrong one.
 *
 * Persisted to localStorage because the most common mobile interruption is a
 * phone call, not a navigation.
 */

const STORAGE_KEY = 'solis-cart-v1';
const MAX_QUANTITY = 99; /* matches the CHECK constraint on order_items */

const CartContext = createContext(null);

const readStored = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    /* Anything malformed is dropped rather than trusted — this data has been
       sitting in a place the user can edit. */
    return parsed
      .filter(
        (line) =>
          line &&
          typeof line.id === 'string' &&
          typeof line.name === 'string' &&
          Number.isInteger(line.pricePiastres) &&
          line.pricePiastres >= 0 &&
          Number.isInteger(line.quantity) &&
          line.quantity > 0
      )
      .map((line) => ({
        id: line.id,
        name: line.name,
        pricePiastres: line.pricePiastres,
        meta: typeof line.meta === 'string' ? line.meta : undefined,
        quantity: Math.min(line.quantity, MAX_QUANTITY),
      }));
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [lines, setLines] = useState(readStored);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* Private mode, or the quota is full. Losing persistence is not worth
         breaking the cart over. */
    }
  }, [lines]);

  const add = useCallback((item, quantity = 1) => {
    /* No database id means the menu is being served from the bundled snapshot,
       and the RPC has nothing to price the line against. */
    if (!item?.id) return false;

    setLines((current) => {
      const existing = current.find((line) => line.id === item.id);
      if (existing) {
        return current.map((line) =>
          line.id === item.id
            ? { ...line, quantity: Math.min(line.quantity + quantity, MAX_QUANTITY) }
            : line
        );
      }
      return [
        ...current,
        {
          id: item.id,
          name: item.name,
          pricePiastres: item.pricePiastres ?? Math.round(item.price * 100),
          meta: item.meta,
          quantity: Math.min(quantity, MAX_QUANTITY),
        },
      ];
    });
    return true;
  }, []);

  const setQuantity = useCallback((id, quantity) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.id !== id)
        : current.map((line) =>
            line.id === id ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY) } : line
          )
    );
  }, []);

  const remove = useCallback((id) => {
    setLines((current) => current.filter((line) => line.id !== id));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  /**
   * Drop lines for items the live menu no longer offers.
   *
   * Without this, a cart left open overnight while something sold out would fail
   * at checkout with "one or more items are no longer available" and no
   * indication of which — the RPC refuses the whole order rather than silently
   * shipping a smaller one. Better to prune it up front, while the customer can
   * still see what changed.
   */
  const reconcile = useCallback((availableById) => {
    setLines((current) => {
      const kept = current
        .filter((line) => availableById.has(line.id))
        .map((line) => {
          const live = availableById.get(line.id);
          /* Follow the current price. The database would win at checkout
             regardless; showing it now avoids a surprise at the total. */
          return live.pricePiastres === line.pricePiastres
            ? line
            : { ...line, pricePiastres: live.pricePiastres, name: live.name };
        });

      const changed =
        kept.length !== current.length || kept.some((line, i) => line !== current[i]);
      return changed ? kept : current;
    });
  }, []);

  const value = useMemo(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotalPiastres = lines.reduce(
      (sum, line) => sum + line.pricePiastres * line.quantity,
      0
    );

    return {
      lines,
      count,
      subtotalPiastres,
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add,
      setQuantity,
      remove,
      clear,
      reconcile,
      /* The wire format for place_order: ids and quantities only. Prices are
         deliberately absent — the server decides them. */
      toPayload: () => lines.map((line) => ({ menu_item_id: line.id, quantity: line.quantity })),
    };
  }, [lines, isOpen, add, setQuantity, remove, clear, reconcile]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
};
