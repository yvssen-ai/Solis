-- Send order emails through a provider that does not require a domain.
--
-- Resend refuses to send from its shared `onboarding@resend.dev` address without
-- a verified domain — "Domain is not verified" — and a cafe running on a
-- vercel.app subdomain has no domain to verify. Buying and configuring one is a
-- reasonable thing to do eventually, and an unreasonable prerequisite for
-- getting the first order notification.
--
-- Brevo verifies a single *sender address* instead: sign up with an email, click
-- the link, and that address can send. Free tier is 300 messages a day, which is
-- a busier cafe than this one.
--
-- Whichever key is present in the vault decides where the email goes, so nothing
-- has to be deleted to switch:
--
--   brevo_api_key   → Brevo      (no domain needed; sender is your own address)
--   resend_api_key  → Resend     (needs a verified domain)
--
-- Brevo wins if both are set.

create or replace function public.notify_new_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brevo  text;
  v_resend text;
  v_to     text;
  v_from   text;
  v_email  jsonb;
begin
  select decrypted_secret into v_to    from vault.decrypted_secrets where name = 'order_notify_to';
  select decrypted_secret into v_from  from vault.decrypted_secrets where name = 'order_notify_from';
  select decrypted_secret into v_brevo from vault.decrypted_secrets where name = 'brevo_api_key';
  select decrypted_secret into v_resend from vault.decrypted_secrets where name = 'resend_api_key';

  -- Not configured yet: take the order anyway. A missing notification must never
  -- be a reason to refuse a customer's order.
  if v_to is null or (v_brevo is null and v_resend is null) then
    return null;
  end if;

  v_email := public.order_email(new.id);
  if v_email is null then return null; end if;

  if v_brevo is not null then
    perform net.http_post(
      url     := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object(
                   'api-key',      v_brevo,
                   'Content-Type', 'application/json',
                   'Accept',       'application/json'
                 ),
      body    := jsonb_build_object(
                   -- Defaults to sending from the same address it sends to,
                   -- which is the one Brevo verified at sign-up. That looks odd
                   -- and is exactly right: it is a note from the shop to itself.
                   'sender',      jsonb_build_object('name', 'Solis Orders',
                                                     'email', coalesce(v_from, v_to)),
                   'to',          jsonb_build_array(jsonb_build_object('email', v_to)),
                   'subject',     v_email ->> 'subject',
                   'textContent', v_email ->> 'text',
                   'htmlContent', v_email ->> 'html'
                 ),
      timeout_milliseconds := 5000
    );
    return null;
  end if;

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_resend,
                 'Content-Type',  'application/json'
               ),
    body    := jsonb_build_object(
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

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Configuration — run once
-- ---------------------------------------------------------------------------
--
--   select vault.create_secret('xkeysib-your-key', 'brevo_api_key');
--
-- `order_notify_to` is already set if Resend was configured earlier; the same
-- value is reused. To check what was sent and what came back:
--
--   select created, status_code, content
--     from net._http_response order by created desc limit 5;
--
-- Brevo answers 201 with {"messageId":"..."} on success.
