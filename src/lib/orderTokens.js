/**
 * Receipts, kept on the device.
 *
 * With no accounts there is nothing to tie an order to a person, so each one
 * comes back with a random token and that token is what lets the customer look
 * it up again. It is stored here, in localStorage, exactly like a paper receipt
 * in a pocket: whoever has it can see the order, and losing it loses the ability
 * to track — not the order itself, which the counter already has.
 *
 * The consequence worth being honest about is that "My orders" is per-device.
 * Order on a phone and it is not visible on a laptop. For a cafe that is the
 * right trade: nobody should have to create an account to buy a croissant, and
 * the order number on screen is what the counter actually asks for.
 */

const STORAGE_KEY = 'solis-orders-v1';

/* Enough to cover a regular's history without letting the list grow forever;
   get_orders() refuses more than 25 tokens in one call. */
const MAX_KEPT = 25;

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const readTokens = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    /* This has been sitting somewhere the user can edit, and it is fed straight
       into a uuid[] parameter — anything that is not a uuid is dropped rather
       than sent. */
    return Array.isArray(parsed) ? parsed.filter(isUuid).slice(0, MAX_KEPT) : [];
  } catch {
    return [];
  }
};

export const rememberToken = (token) => {
  if (!isUuid(token)) return readTokens();

  /* Newest first, no duplicates. */
  const next = [token, ...readTokens().filter((t) => t !== token)].slice(0, MAX_KEPT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode or a full quota. Losing the receipt is a shame but must not
       break the confirmation the customer is currently looking at. */
  }
  return next;
};
