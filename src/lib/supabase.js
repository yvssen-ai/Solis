/**
 * Supabase access, over plain fetch.
 *
 * There is no `@supabase/supabase-js` here, and that is the point. The package
 * is 62 kB gzipped — auth, realtime, storage and postgrest together — and the
 * only part this site ever needed was the ability to GET two tables and POST to
 * two functions. Both are a handful of lines against PostgREST directly, and the
 * browser already has fetch.
 *
 * It was carried, lazily, for as long as customers had to sign in to order.
 * Once ordering became name-and-phone there was no session to manage, no token
 * to refresh and no socket to hold open, and the dependency went with it — worth
 * roughly 57 kB of JavaScript that no longer has to exist.
 *
 *   restSelect()  anonymous table reads   → the menu
 *   rpc()         function calls          → place_order, get_orders
 */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[solis] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set — ' +
      'running on the bundled menu snapshot with ordering disabled.'
  );
}

/* ------------------------------------------------------------------------- */
/* Anonymous reads, without the SDK                                          */
/* ------------------------------------------------------------------------- */

/**
 * GET one table through the Data API.
 *
 * `query` is passed to PostgREST verbatim, e.g. `select=id,name&order=sort_order`.
 * Only ever used for the menu, which is public: the `apikey` header identifies
 * the project, the request runs as `anon`, and RLS decides what comes back.
 */
export async function restSelect(table, query) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: PUBLISHABLE_KEY,
      /* PostgREST wants a bearer token; for anonymous reads it is the same key. */
      authorization: `Bearer ${PUBLISHABLE_KEY}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    /* PostgREST puts a JSON body on errors, but a proxy or a paused project may
       not, so the status is the part that can be relied on. */
    const detail = await response.text().catch(() => '');
    throw new Error(`${table}: ${response.status} ${detail.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Call a Postgres function through the Data API.
 *
 * PostgREST maps `POST /rest/v1/rpc/<name>` with a JSON body of named arguments
 * onto a function call, and returns whatever the function returns. Both of the
 * ones used here are SECURITY DEFINER and do their own checking — the client is
 * `anon` and holds no privileges on the tables underneath.
 *
 * Errors raised with RAISE EXCEPTION arrive as a JSON body with `message` set to
 * the text the function chose, which is why place_order's messages are written
 * to be read by a customer.
 */
export async function rpc(fn, args) {
  if (!isSupabaseConfigured) throw new Error('Ordering is not available right now.');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${PUBLISHABLE_KEY}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(args ?? {}),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    /* Prefer the function's own wording; fall back to something a person can
       read rather than a bare status code. */
    const error = new Error(body?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.details = body;
    throw error;
  }

  return body;
}

/* ------------------------------------------------------------------------- */
/* Money                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Prices travel as integer piastres (1 EGP = 100). Money is never a float here:
 * 0.1 + 0.2 is 0.30000000000000004 in binary floating point, and a bill that is
 * wrong by a fraction of a piastre is a bug nobody can explain at the counter.
 */
export const PIASTRES_PER_POUND = 100;

/**
 * Format piastres as pounds. Whole pounds print without decimals — "110", not
 * "110.00" — because every price on this menu is a round number and the trailing
 * zeros are just noise. Anything with piastres keeps them.
 */
export const formatPiastres = (piastres) => {
  const isWhole = piastres % PIASTRES_PER_POUND === 0;
  return (piastres / PIASTRES_PER_POUND).toLocaleString('en-US', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

/* ------------------------------------------------------------------------- */
/* Errors                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * Turn a Supabase / PostgREST error into something worth showing a customer.
 *
 * `place_order` raises its own messages ("Delivery orders need an address"),
 * written to be read by a human, and those pass straight through. Anything else
 * — a permission error, a constraint name, a socket failure — gets a generic
 * line, because the raw text is either meaningless to the reader or tells an
 * attacker about the schema.
 */
export const friendlyError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;

  const message = String(error.message ?? error);

  if (/Failed to fetch|NetworkError|network request failed|load failed/i.test(message)) {
    return 'Could not reach the kitchen. Check your connection and try again.';
  }
  if (/permission denied|JWT|not authorized|401|403/i.test(message)) {
    return 'Please sign in again to continue.';
  }
  if (/rate limit|too many requests|429/i.test(message)) {
    return 'Too many attempts. Give it a minute and try again.';
  }
  /* Messages raised deliberately by place_order() read as plain sentences. */
  if (
    /^[A-Z][^_]*$/.test(message) &&
    message.length < 120 &&
    !/relation|column|function|schema/i.test(message)
  ) {
    return message;
  }
  return fallback;
};
