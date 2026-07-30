-- Ring the counter when an order arrives.
--
-- An AFTER INSERT trigger on public.orders posts the new order's id to the
-- `notify-order` edge function, which reads the order back and emails it.
--
-- Only the id is sent, deliberately. place_order() inserts the order row first
-- and its line items immediately afterwards, so anything assembled inside this
-- trigger would describe an order with no items in it. pg_net queues the request
-- inside the transaction and its background worker sends it after commit, by
-- which time the whole order — items included — is durable and readable.
--
-- The URL and shared secret live in Vault rather than in this file so the same
-- migration is safe to commit and to run against any project.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'order_webhook_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'order_webhook_secret';

  -- Not configured yet: take the order anyway. A missing notification must
  -- never be a reason to refuse a customer's order.
  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',      'application/json',
                 'x-solis-signature', v_secret
               ),
    body    := jsonb_build_object('order_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Same reasoning: the order is the thing that matters. Log and carry on
    -- rather than rolling back a paid-for coffee because an inbox was down.
    raise warning 'notify_new_order failed for %: %', new.order_number, sqlerrm;
    return new;
end;
$$;

-- Nobody calls this directly; the trigger invokes it as the table owner.
revoke all on function public.notify_new_order() from public, anon, authenticated;

create trigger orders_notify_counter
  after insert on public.orders
  for each row execute function public.notify_new_order();

-- ---------------------------------------------------------------------------
-- Configuration (run once per project, with your own values)
-- ---------------------------------------------------------------------------
--
-- Left commented out on purpose: a real secret does not belong in version
-- control, and re-running a migration should not overwrite one already set.
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1/notify-order',
--     'order_webhook_url');
--
--   select vault.create_secret(
--     '<a long random string, also set as ORDER_WEBHOOK_SECRET>',
--     'order_webhook_secret');
--
-- To check what has been delivered:
--   select status_code, content, created
--     from net._http_response order by created desc limit 10;
