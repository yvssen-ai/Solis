/**
 * Supabase access, split in two on purpose.
 *
 * `@supabase/supabase-js` is 62 kB gzipped — auth, realtime, storage and
 * postgrest in one package. Importing it at the top level put the whole thing on
 * the critical path of a site whose first screen is a video and a menu, taking
 * the main bundle from 115 kB to 178 kB gzipped for a feature most visitors
 * never touch. So:
 *
 *   - Reading the menu, which every visitor does, goes through `restSelect()`
 *     below: a plain fetch against PostgREST. Two headers and a query string is
 *     the entire protocol for an anonymous read, and the browser already has
 *     fetch.
 *   - Everything stateful — sign-in, placing an order, realtime status — needs
 *     the real client, and is loaded by `loadSupabase()` the first time it is
 *     actually wanted.
 *
 * The client is a memoized singleton. Creating two would give them separate
 * auth listeners and separate realtime sockets.
 */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);

/* Where the session is kept. Named here rather than left to the default because
   `hasStoredSession()` needs to look for it before the client exists. */
export const AUTH_STORAGE_KEY = 'solis-auth';

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

/* ------------------------------------------------------------------------- */
/* The full client, on demand                                               */
/* ------------------------------------------------------------------------- */

let clientPromise = null;

/**
 * Resolve the shared Supabase client, importing the SDK on first call.
 *
 * Returns null when the project is not configured, which callers treat as
 * "ordering is off" rather than as an error.
 */
export function loadSupabase() {
  if (!isSupabaseConfigured) return Promise.resolve(null);

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /* Magic-link sign-in returns here with the session in the URL; this is
           what reads it and then tidies the address bar. */
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: AUTH_STORAGE_KEY,
      },
      global: { headers: { 'x-application-name': 'solis-web' } },
    })
  );

  return clientPromise;
}

/**
 * Start downloading the SDK without waiting for it.
 *
 * Called when the cart gets its first item: by the time the customer taps
 * through to checkout the chunk is usually already there, so the drawer opens at
 * full speed instead of waiting on a network round trip.
 */
export const warmSupabase = () => {
  if (isSupabaseConfigured) loadSupabase();
};

/** Has this browser signed in before? Answered without loading the SDK. */
export const hasStoredSession = () => {
  try {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEY));
  } catch {
    return false;
  }
};

/**
 * Is there an auth response sitting in the current URL?
 *
 * PKCE comes back as `?code=`, the implicit flow as `#access_token=`, and either
 * failure mode as an `error` parameter. Any of them means the SDK has to
 * initialize now, before `detectSessionInUrl` has a chance to miss its window.
 */
export const hasAuthInUrl = () => {
  if (typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  return /[?&](code|error|error_description)=/.test(search) || /access_token=|error=/.test(hash);
};

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
