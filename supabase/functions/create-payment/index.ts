/**
 * Start a card payment for an existing order — Kashier.
 *
 * The browser sends an order id and the receipt token it was given. It does not
 * send an amount, and there is no parameter for one: the amount is read here,
 * from the row place_order wrote. That is the whole reason this runs on a server
 * — a checkout that takes its price from the client is a checkout that can be
 * bought from for one piastre.
 *
 * Kashier's hosted page needs no API call to set up. The checkout URL is built
 * from signed query parameters, and the signature is what makes the amount
 * un-editable in transit: change a digit and the hash no longer matches. The
 * signing key still has to stay on a server, which is why this is a function and
 * not a few lines in the cart drawer.
 *
 * Secrets live in the function's environment (`supabase secrets set`). Nothing
 * here may ever be exposed as VITE_*, which is compiled into the browser bundle.
 */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  KASHIER_MERCHANT_ID,
  KASHIER_PAYMENT_KEY,
  KASHIER_MODE,
  SITE_URL,
} = Deno.env.toObject();

const MODE = KASHIER_MODE === 'live' ? 'live' : 'test';
const CHECKOUT = 'https://checkout.kashier.io/';

const cors = {
  'access-control-allow-origin': SITE_URL || '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

/** PostgREST, as service_role. Same plain-fetch approach the client uses. */
async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`db ${path}: ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!KASHIER_MERCHANT_ID || !KASHIER_PAYMENT_KEY) {
    console.error('kashier env not set');
    return json({ error: 'Card payments are not switched on yet.' }, 503);
  }

  try {
    const { order_id, public_token } = await request.json();
    if (!order_id || !public_token) return json({ error: 'Missing order details.' }, 400);

    /* The token is the authorisation. Whoever placed the order holds it; nobody
       else can name it, so nobody else can start a payment against the order. */
    const rows = await db(
      `orders?id=eq.${encodeURIComponent(order_id)}` +
        `&public_token=eq.${encodeURIComponent(public_token)}` +
        `&select=id,total_piastres,payment_status`
    );

    const order = rows?.[0];
    if (!order) return json({ error: 'Order not found.' }, 404);
    if (order.payment_status === 'paid') return json({ error: 'Already paid.' }, 409);
    if (!order.total_piastres || order.total_piastres <= 0) {
      return json({ error: 'Nothing to pay.' }, 400);
    }

    /* Kashier prices in pounds, not piastres, so this is the one place the
       integer total becomes a decimal. Dividing an integer by 100 and fixing to
       two places is exact — the value never becomes a float that can drift. */
    const amount = (order.total_piastres / 100).toFixed(2);
    const currency = 'EGP';
    const orderId = String(order.id);

    /* Kashier signs this exact string, in this exact shape. The hash is what
       stops the amount being edited in the URL on the way to the checkout. */
    const hash = await hmacSha256Hex(
      KASHIER_PAYMENT_KEY,
      `/?payment=${KASHIER_MERCHANT_ID}.${orderId}.${amount}.${currency}`
    );

    const params = new URLSearchParams({
      merchantId: KASHIER_MERCHANT_ID,
      orderId,
      amount,
      currency,
      hash,
      mode: MODE,
      allowedMethods: 'card',
      display: 'en',
      /* Where the customer lands afterwards. This is a cue to re-read the order,
         never proof of payment — see the webhook. */
      merchantRedirect: `${SITE_URL}/?order=${orderId}`,
      serverWebhook: `${SUPABASE_URL}/functions/v1/kashier-webhook`,
    });

    /* Pending, not paid. Only the webhook may say paid. */
    await db(`orders?id=eq.${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_method: 'card',
        payment_status: 'pending',
        payment_provider: 'kashier',
      }),
    });

    return json({ checkout_url: `${CHECKOUT}?${params.toString()}` });
  } catch (failure) {
    console.error('create-payment', failure);
    return json({ error: 'Could not start the payment. Please try again.' }, 500);
  }
});
