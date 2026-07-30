/**
 * Start a card payment for an existing order.
 *
 * The browser sends an order id and the receipt token it was given. It does not
 * send an amount, and there is no parameter for one: the amount is read here,
 * from the row place_order wrote. That is the whole reason this runs on a server
 * — a checkout that takes its price from the client is a checkout that can be
 * bought from for one piastre.
 *
 * Secrets live in the function's environment (`supabase secrets set`). Nothing
 * here may ever be exposed as VITE_*, which is compiled into the browser bundle.
 */

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PAYMOB_SECRET_KEY,
  PAYMOB_PUBLIC_KEY,
  PAYMOB_INTEGRATION_ID,
  SITE_URL,
} = Deno.env.toObject();

const PAYMOB_API = 'https://accept.paymob.com';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !PAYMOB_INTEGRATION_ID) {
    console.error('paymob env not set');
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
        `&select=id,total_piastres,payment_status,customer_name,customer_phone`
    );

    const order = rows?.[0];
    if (!order) return json({ error: 'Order not found.' }, 404);
    if (order.payment_status === 'paid') return json({ error: 'Already paid.' }, 409);
    if (!order.total_piastres || order.total_piastres <= 0) {
      return json({ error: 'Nothing to pay.' }, 400);
    }

    /* Paymob wants the smallest currency unit, which for EGP is piastres —
       exactly how the total is already stored, so there is no conversion here
       and therefore no rounding to get wrong. */
    const [first, ...rest] = String(order.customer_name ?? 'Guest').trim().split(/\s+/);

    const intention = await fetch(`${PAYMOB_API}/v1/intention/`, {
      method: 'POST',
      headers: {
        authorization: `Token ${PAYMOB_SECRET_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: order.total_piastres,
        currency: 'EGP',
        payment_methods: [Number(PAYMOB_INTEGRATION_ID)],
        /* Our own id, echoed back on the callback as order.merchant_order_id.
           It is how the webhook knows which order was paid for. */
        special_reference: order.id,
        items: [
          {
            name: `Solis order ${String(order.id).slice(0, 8)}`,
            amount: order.total_piastres,
            quantity: 1,
          },
        ],
        billing_data: {
          first_name: first || 'Guest',
          last_name: rest.join(' ') || '-',
          phone_number: order.customer_phone ?? 'NA',
          email: 'orders@solis.local',
        },
      }),
    });

    if (!intention.ok) {
      console.error('paymob intention failed', intention.status, await intention.text());
      return json({ error: 'Could not start the payment. Please try again.' }, 502);
    }

    const { client_secret } = await intention.json();
    if (!client_secret) return json({ error: 'Could not start the payment.' }, 502);

    /* Pending, not paid. Only the webhook may say paid. */
    await db(`orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_method: 'card',
        payment_status: 'pending',
        payment_provider: 'paymob',
      }),
    });

    return json({
      checkout_url:
        `${PAYMOB_API}/unifiedcheckout/?publicKey=${encodeURIComponent(PAYMOB_PUBLIC_KEY)}` +
        `&clientSecret=${encodeURIComponent(client_secret)}`,
    });
  } catch (failure) {
    console.error('create-payment', failure);
    return json({ error: 'Could not start the payment. Please try again.' }, 500);
  }
});
