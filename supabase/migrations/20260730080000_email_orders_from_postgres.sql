-- Email every order to the counter, from inside the database.
--
-- This replaces the `notify-order` edge function. The function was correct, but
-- deploying it needs the Supabase CLI — install, log in, link, set secrets,
-- deploy — and that is a lot of moving parts to stand between a cafe and its
-- order notifications. Everything below runs in one SQL statement and needs no
-- toolchain at all: paste it into the SQL editor, add one secret, done.
--
-- The trade is that the email is assembled in SQL rather than TypeScript. That
-- is uglier to read and it is the reason for html_escape() below, which a
-- template language would have given for free.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Formatting
-- ---------------------------------------------------------------------------

-- Customer names and notes are free text typed by a stranger and they land in an
-- inbox. Without this, a note containing markup is interpreted rather than read.
create or replace function public.html_escape(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(
    coalesce(p_text, ''),
    '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- Piastres to a pounds string. Whole pounds lose the ".00" — every price on this
-- menu is a round number and the zeros are only noise.
create or replace function public.format_pounds(p_piastres integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_piastres % 100 = 0
      then to_char(p_piastres / 100, 'FM999,999,999')
    else to_char(p_piastres / 100.0, 'FM999,999,999.00')
  end;
$$;

/**
 * Build the notification email for one order.
 *
 * Returns { subject, text, html }. Separated from the sending so it can be
 * inspected — `select public.order_email(id) from public.orders limit 1` shows
 * exactly what would go out, without sending anything.
 */
create or replace function public.order_email(p_order_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  o           public.orders;
  v_when      text;
  v_kind      text;
  v_count     integer;
  v_rows      text := '';
  v_lines     text := '';
  v_details   text := '';
  v_item      record;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then return null; end if;

  -- Cairo, because that is where the counter is. Egypt reinstated summer time in
  -- 2023, so this is UTC+2 or UTC+3 depending on the date; the timezone name
  -- handles that, a fixed offset would not.
  v_when := to_char(o.created_at at time zone 'Africa/Cairo', 'Dy DD Mon, HH24:MI');
  v_kind := case when o.fulfilment = 'delivery' then 'Delivery' else 'Pickup' end;

  select coalesce(sum(quantity), 0) into v_count
  from public.order_items where order_id = o.id;

  for v_item in
    select name_snapshot, quantity, unit_price_piastres, line_total_piastres
    from public.order_items where order_id = o.id order by name_snapshot
  loop
    v_rows := v_rows || format(
      '<tr><td style="padding:10px 0;border-bottom:1px solid #e6e4dd;font-size:15px;color:#14200f;">'
      '<strong style="color:#2a4326;">%s×</strong>&nbsp; %s'
      '<div style="font-size:12px;color:#7b7f76;">E£ %s each</div></td>'
      '<td align="right" style="padding:10px 0;border-bottom:1px solid #e6e4dd;font-size:15px;color:#14200f;white-space:nowrap;">E£ %s</td></tr>',
      v_item.quantity,
      public.html_escape(v_item.name_snapshot),
      public.format_pounds(v_item.unit_price_piastres),
      public.format_pounds(v_item.line_total_piastres)
    );

    v_lines := v_lines || format(
      '  %s x %s  —  E£ %s' || E'\n',
      v_item.quantity, v_item.name_snapshot,
      public.format_pounds(v_item.line_total_piastres)
    );
  end loop;

  -- Name and phone are the point of the whole email: they are what the counter
  -- needs to hand the order over, and there is no account to look them up in.
  v_details :=
    format('<tr><td style="padding:3px 0;font-size:13px;color:#7b7f76;width:90px;">Name</td>'
           '<td style="padding:3px 0;font-size:15px;color:#14200f;"><strong>%s</strong></td></tr>',
           public.html_escape(o.customer_name)) ||
    format('<tr><td style="padding:3px 0;font-size:13px;color:#7b7f76;">Phone</td>'
           '<td style="padding:3px 0;font-size:15px;"><a href="tel:%s" style="color:#2a4326;"><strong>%s</strong></a></td></tr>',
           regexp_replace(o.customer_phone, '[^0-9+]', '', 'g'),
           public.html_escape(o.customer_phone));

  if o.fulfilment = 'delivery' and coalesce(o.address, '') <> '' then
    v_details := v_details || format(
      '<tr><td style="padding:3px 0;font-size:13px;color:#7b7f76;">Address</td>'
      '<td style="padding:3px 0;font-size:15px;color:#14200f;">%s</td></tr>',
      public.html_escape(o.address));
  end if;

  if coalesce(o.notes, '') <> '' then
    v_details := v_details || format(
      '<tr><td style="padding:3px 0;font-size:13px;color:#7b7f76;">Note</td>'
      '<td style="padding:3px 0;font-size:15px;color:#14200f;"><em>%s</em></td></tr>',
      public.html_escape(o.notes));
  end if;

  return jsonb_build_object(
    'subject', format('%s · %s · E£ %s · %s item%s',
                      o.order_number, v_kind, public.format_pounds(o.total_piastres),
                      v_count, case when v_count = 1 then '' else 's' end),

    -- A phone showing a notification preview renders the plain text, and that is
    -- what gets read first behind a counter.
    'text', format(E'%s\n%s · %s\n\n%s · %s\n%s%s\n%sTOTAL  E£ %s',
             o.order_number, upper(v_kind), v_when,
             o.customer_name, o.customer_phone,
             case when o.fulfilment = 'delivery' and coalesce(o.address,'') <> ''
                  then 'Address: ' || o.address || E'\n' else '' end,
             case when coalesce(o.notes,'') <> ''
                  then 'Note: ' || o.notes || E'\n' else '' end,
             v_lines,
             public.format_pounds(o.total_piastres)),

    -- Table layout with inline styles: Gmail strips <style> blocks and ignores
    -- flexbox and grid outright, so anything cleverer arrives as a stack of
    -- unstyled text on exactly the client this is aimed at.
    'html', format(
      '<!doctype html><html><body style="margin:0;padding:0;background:#f1efe9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Helvetica,Arial,sans-serif;">'
      '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f1efe9;padding:24px 12px;"><tr><td align="center">'
      '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">'
      '<tr><td style="background:#2a4326;padding:22px 24px;">'
      '<div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#d8a75e;">New order</div>'
      '<div style="font-size:26px;color:#f7f9f7;padding-top:4px;">%s</div>'
      '<div style="font-size:13px;color:#b9c4b2;padding-top:6px;">%s · %s</div></td></tr>'
      '<tr><td style="padding:20px 24px 4px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0">%s</table></td></tr>'
      '<tr><td style="padding:14px 24px 0;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0">%s</table></td></tr>'
      '<tr><td style="padding:16px 24px 26px;"><table role="presentation" width="100%%" cellpadding="0" cellspacing="0"><tr>'
      '<td style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7b7f76;">Total</td>'
      '<td align="right" style="font-size:24px;color:#2a4326;white-space:nowrap;">E£ %s</td></tr></table></td></tr>'
      '<tr><td style="background:#f1efe9;padding:14px 24px;font-size:12px;color:#7b7f76;">'
      'Paid at the counter. Change the status in the Solis dashboard and the customer sees it on their phone.'
      '</td></tr></table></td></tr></table></body></html>',
      public.html_escape(o.order_number), v_kind, v_when,
      v_details, v_rows, public.format_pounds(o.total_piastres))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Sending
-- ---------------------------------------------------------------------------

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key   text;
  v_to    text;
  v_from  text;
  v_email jsonb;
begin
  select decrypted_secret into v_key  from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into v_to   from vault.decrypted_secrets where name = 'order_notify_to';
  select decrypted_secret into v_from from vault.decrypted_secrets where name = 'order_notify_from';

  -- Not configured yet: take the order anyway. A missing notification must never
  -- be a reason to refuse a customer's order.
  if v_key is null or v_to is null then
    return null;
  end if;

  v_email := public.order_email(new.id);
  if v_email is null then return null; end if;

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_key,
                 'Content-Type',  'application/json'
               ),
    body    := jsonb_build_object(
                 -- Resend's shared sender works with no domain set up, which is
                 -- what makes this usable today. It can only deliver to the
                 -- address that owns the Resend account — which is exactly the
                 -- case here. Swap it once a domain is verified.
                 'from',    coalesce(v_from, 'Solis Orders <onboarding@resend.dev>'),
                 'to',      jsonb_build_array(v_to),
                 'subject', v_email ->> 'subject',
                 'text',    v_email ->> 'text',
                 'html',    v_email ->> 'html'
               ),
    timeout_milliseconds := 5000
  );

  return null;
exception
  when others then
    raise warning 'notify_new_order failed for %: %', new.order_number, sqlerrm;
    return null;
end;
$$;

revoke all on function public.notify_new_order() from public, anon, authenticated;
revoke all on function public.order_email(uuid)  from public, anon, authenticated;
revoke all on function public.html_escape(text)  from anon, authenticated;
revoke all on function public.format_pounds(integer) from anon, authenticated;

-- A CONSTRAINT TRIGGER, deferred to commit — not a plain AFTER INSERT one.
--
-- place_order() inserts the order row and then its line items. A normal AFTER
-- INSERT trigger on `orders` fires between those two statements, so the email it
-- built would list nothing. Deferring to the end of the transaction means every
-- item is there to be read.
drop trigger if exists orders_notify_counter on public.orders;

create constraint trigger orders_notify_counter
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.notify_new_order();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Configuration — run once, with your own values
-- ---------------------------------------------------------------------------
--
--   select vault.create_secret('re_your_key_here',      'resend_api_key');
--   select vault.create_secret('you@gmail.com',         'order_notify_to');
--
-- To see what has been sent, and what Resend said back:
--   select created, status_code, content
--     from net._http_response order by created desc limit 10;
--
-- To preview an email without sending one:
--   select public.order_email(id) ->> 'html' from public.orders order by created_at desc limit 1;
