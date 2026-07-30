/**
 * Emails the counter whenever an order is placed.
 *
 * Called by a trigger on `public.orders` (see the
 * `notify_order_by_email` migration), not by the browser. It has to live here
 * rather than in the client for one reason: sending mail needs a provider API
 * key, and anything the browser can read is public. Vite inlines every VITE_
 * variable into the bundle, so there is no version of this that is safe on the
 * front end.
 *
 * Environment (set with `supabase secrets set`):
 *   RESEND_API_KEY        required — https://resend.com, free tier is 100/day
 *   ORDER_NOTIFY_TO       required — where orders land, e.g. your Gmail
 *   ORDER_NOTIFY_FROM     optional — defaults to Resend's shared sender
 *   ORDER_WEBHOOK_SECRET  required — shared with the database trigger
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { htmlFor, subjectFor, textFor, type Order } from './email.ts';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Constant-time-ish comparison of the shared secret.
 *
 * This function is deployed with `--no-verify-jwt` so the database can reach it
 * without minting a token, which means the URL is open to the internet. The
 * secret header is what stands between that and anyone being able to make your
 * inbox ring. Comparing with `===` would leak length and prefix information
 * through timing; over the public internet that is largely theoretical, but the
 * fix costs three lines.
 */
const secretMatches = (given: string | null, expected: string): boolean => {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedSecret = Deno.env.get('ORDER_WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('ORDER_WEBHOOK_SECRET is not set; refusing to run unauthenticated');
    return new Response('Not configured', { status: 500 });
  }
  if (!secretMatches(req.headers.get('x-solis-signature'), expectedSecret)) {
    return new Response('Forbidden', { status: 403 });
  }

  let orderId: string | undefined;
  try {
    ({ order_id: orderId } = await req.json());
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  if (!orderId) return new Response('Missing order_id', { status: 400 });

  /* Service role: this runs on the server with no user session, and it has to
     read an order belonging to somebody else. The key never leaves this
     function. */
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  /* The trigger hands over an id rather than the row itself, so this read
     happens after the transaction has committed — which is the only way the
     line items are guaranteed to be here. place_order() inserts the order first
     and its items immediately after, so a payload built inside the trigger
     would describe an order with nothing in it. */
  const { data, error } = await supabase
    .from('orders')
    .select(
      `order_number, status, fulfilment, customer_name, customer_phone, address,
       notes, subtotal_piastres, total_piastres, created_at,
       order_items ( name_snapshot, quantity, unit_price_piastres, line_total_piastres )`
    )
    .eq('id', orderId)
    .single();

  if (error || !data) {
    console.error('could not load order', orderId, error);
    return new Response('Order not found', { status: 404 });
  }

  const order = data as unknown as Order;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ORDER_NOTIFY_TO');
  if (!resendKey || !to) {
    console.error('RESEND_API_KEY / ORDER_NOTIFY_TO missing; nothing sent');
    return new Response('Email not configured', { status: 500 });
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      /* Resend's shared sender works with no domain set up, which is what makes
         this deployable today. Swap it for orders@yourdomain once the domain is
         verified — shared senders are far more likely to land in spam. */
      from: Deno.env.get('ORDER_NOTIFY_FROM') ?? 'Solis Orders <onboarding@resend.dev>',
      to: to.split(',').map((address) => address.trim()),
      /* No reply_to: orders are placed without an account, so there is no
         customer address to reply to. The phone number in the body is how the
         counter gets back to them, and it is a tel: link for exactly that. */
      subject: subjectFor(order),
      text: textFor(order),
      html: htmlFor(order),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('resend rejected the message', response.status, detail);
    /* A non-2xx tells pg_net's response log that this needs looking at. The
       order itself is already committed and safe — only the notification
       failed. */
    return new Response(`Send failed: ${response.status}`, { status: 502 });
  }

  console.log('notified', order.order_number);
  return new Response(JSON.stringify({ sent: order.order_number }), {
    headers: { 'content-type': 'application/json' },
  });
});
