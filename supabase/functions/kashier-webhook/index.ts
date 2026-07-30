/**
 * Kashier's server webhook. The only thing in the system that may mark an order
 * paid.
 *
 * Why not the redirect back to the site: the customer's browser returns to a URL
 * we chose, and anyone can type that URL. It proves nothing. This endpoint is
 * called server-to-server by Kashier and is signed, so it is the only account of
 * events worth believing.
 *
 * Two properties this has to hold:
 *
 *   Signed     — every callback carries an HMAC-SHA256 over its own fields. An
 *                unverified endpoint is a free-orders button for anyone who
 *                finds the URL.
 *   Idempotent — gateways retry, and will deliver the same transaction twice.
 *                The unique index on (payment_provider, payment_ref) and the
 *                `payment_status <> 'paid'` guard inside mark_order_paid
 *                together make a replay a no-op.
 *
 * Deploy with --no-verify-jwt: Kashier calls this, not a signed-in user, and it
 * authenticates itself with the signature instead of a bearer token.
 */

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KASHIER_PAYMENT_KEY } = Deno.env.toObject();

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

/** Constant-time compare, so the endpoint does not leak the signature by timing. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!KASHIER_PAYMENT_KEY) {
    console.error('KASHIER_PAYMENT_KEY not set — refusing to process callbacks');
    return new Response('Not configured', { status: 503 });
  }

  try {
    const payload = await request.json();
    const data = payload?.data ?? payload;

    /* Kashier signs the callback's own fields: every key except the signature
       itself and `mode`, joined as &key=value in the order they arrive. */
    const supplied = String(payload?.signature ?? data?.signature ?? '');
    const message = Object.entries(data)
      .filter(([key]) => key !== 'signature' && key !== 'mode' && key !== 'kashierSignature')
      .map(([key, value]) => `&${key}=${value}`)
      .join('');

    const expected = await hmacSha256Hex(KASHIER_PAYMENT_KEY, message);

    if (!supplied || !safeEqual(supplied.toLowerCase(), expected)) {
      /* Logged in full because a mismatch here is almost always the field list
         differing from the docs, and this line is the only way to see it. */
      console.warn('rejected callback: bad signature', { supplied, expected, message });
      return new Response('Invalid signature', { status: 401 });
    }

    /* orderId went out as our order id and comes back here. */
    const orderId = data?.merchantOrderId ?? data?.orderId;
    const transactionId = data?.transactionId ?? data?.orderReference ?? data?.kashierOrderId;
    const status = String(data?.status ?? data?.paymentStatus ?? '').toUpperCase();
    const success = status === 'SUCCESS' || status === 'PAID' || status === 'CAPTURED';

    if (!orderId || !transactionId) {
      console.error('callback missing order or transaction id', data);
      /* 200 on a malformed body: retrying it would only fail the same way. */
      return new Response('OK', { status: 200 });
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
        p_provider: 'kashier',
        p_ref: String(transactionId),
        p_success: success,
      }),
    });

    if (!response.ok) {
      console.error('mark_order_paid failed', response.status, await response.text());
      /* A non-2xx makes Kashier retry, which is what we want if the database was
         briefly unreachable — the update is idempotent, so a retry is safe. */
      return new Response('Retry', { status: 500 });
    }

    return new Response('OK', { status: 200 });
  } catch (failure) {
    console.error('kashier-webhook', failure);
    return new Response('Retry', { status: 500 });
  }
});
