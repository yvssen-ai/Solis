import { Suspense, lazy, useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import CartFab from './CartFab';

/**
 * Mounts the ordering UI, and only pays for it once someone starts ordering.
 *
 * The drawer carries checkout and order history, neither of which a visitor who
 * came to look at the photographs will ever open. Splitting it out keeps it off
 * the first load of a page whose job above the fold is a video and a menu.
 *
 * The chunk is fetched the moment the cart gets its first item, which is at least
 * one tap and a scroll before the drawer can be opened, so in practice it has
 * always arrived by the time it is needed.
 */
const CartDrawer = lazy(() => import('./CartDrawer'));

export default function Shop() {
  const { count, isOpen } = useCart();
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (wanted || (count === 0 && !isOpen)) return;
    setWanted(true);
  }, [count, isOpen, wanted]);

  return (
    <>
      <CartFab />
      {wanted && (
        /* No fallback: the drawer animates itself in when it mounts, and a
           placeholder would only flash. */
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
    </>
  );
}
