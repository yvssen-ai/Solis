/**
 * Paymob's transaction callback. The only thing in the system that may mark an
 * order paid.
 *
 * Why not the redirect back to the site: the customer's browser returns to a URL
 * we chose, and anyone can type that URL. It proves nothing. This endpoint is
 * called server-to-server by Paymob and is signed, so it is the only account of
 * events worth believing.
 *
 * Two properties this has to hold:
 *
 *   Signed   — every callback carries an HMAC over a fixed list of fields in a
 *              fixed order. An unverified endpoint is a free-orders button for
 *              anyone who finds the URL.
 *   Idempotent — gateways retry, and will deliver the same transaction twice.
 *              The unique index on (payment_provider, payment_ref) and the
 *              `payment_status <> 'paid'` guard inside mark_order_paid together
 *              make a replay a no-op.
 */

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYMOB_HMAC_SECRET } = Deno.env.toObject();

/* Paymob concatenates exactly these fields, in exactly this order, and HMACs the
   result with SHA-512. The order is not alphabetical and is not negotiable —
   getting it wrong fails every callback. */
const HMAC_FIELDS = [
  'amount_cents',
  'created_at',
  'currency',
  'error_occured',
  'has_parent_transaction',
  'id',
  'integration_id',
  'is_3d_secure',
  'is_auth',
  'is_capture',
  'is_refunded',
  'is_standalone_payment',
  'is_voided',
  'order.id',
  'owner',
  'pending',
  'source_data.pan',
  'source_data.sub_type',
  'source_data.type',
  'success',
];

const at = (obj: any, path: string) =>
  path.split('.').reduce((value, key) => (value == null ? value : value[key]), obj);

async function hmacSha512(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare, so the endpoint does not leak the signature by timing. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!PAYMOB_HMAC_SECRET) {
    console.error('PAYMOB_HMAC_SECRET not set — refusing to process callbacks');
    return new Response('Not configured', { status: 503 });
  }

  try {
    const url = new URL(request.url);
    const payload = await request.json();
    const obj = payload?.obj ?? payload;

    const supplied = url.searchParams.get('hmac') ?? payload?.hmac ?? '';
    const expected = await hmacSha512(
      PAYMOB_HMAC_SECRET,
      HMAC_FIELDS.map((field) => {
        const value = at(obj, field);
        /* Booleans arrive as JSON true/false and are hashed as the strings
           "true"/"false"; null and undefined contribute nothing. */
        return value === null || value === undefined ? '' : String(value);
      }).join('')
    );

    if (!safeEqual(supplied.toLowerCase(), expected)) {
      console.warn('rejected callback: bad hmac');
      return new Response('Invalid signature', { status: 401 });
    }

    /* special_reference went out as our order id and comes back here. */
    const orderId = obj?.order?.merchant_order_id;
    const transactionId = obj?.id;
    const success = obj?.success === true || obj?.success === 'true';

    if (!orderId || !transactionId) {
      console.error('callback missing order or transaction id');
      return new Response('OK', { status: 200 }); // don't make Paymob retry a malformed one
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_order_paid`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_order_id: orderId,
        p_provider: 'paymob',
        p_ref: String(transactionId),
        p_success: success,
      }),
    });

    if (!response.ok) {
      console.error('mark_order_paid failed', response.status, await response.text());
      /* A non-2xx makes Paymob retry, which is what we want if the database was
         briefly unreachable — the update is idempotent, so a retry is safe. */
      return new Response('Retry', { status: 500 });
    }

    return new Response('OK', { status: 200 });
  } catch (failure) {
    console.error('paymob-webhook', failure);
    return new Response('Retry', { status: 500 });
  }
});
