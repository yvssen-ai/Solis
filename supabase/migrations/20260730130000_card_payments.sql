-- Card payments.
--
-- Payment is deliberately kept separate from `status`. `status` says where the
-- order is in the kitchen; `payment_status` says whether it has been paid for.
-- A cash order is 'unpaid' right through to 'completed', and that is correct —
-- overloading one column would have made "paid but not yet made" unrepresentable.
--
-- Nothing here trusts the browser. The amount charged is read from
-- orders.total_piastres, which place_order computed from menu_items, so the
-- same guarantee that stops a tampered cart buying a 1450 EGP bag of beans for
-- one piastre also stops it being *charged* for one piastre.

alter table public.orders
  add column if not exists payment_method   text not null default 'cash'
    check (payment_method in ('cash', 'card')),
  add column if not exists payment_status   text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  add column if not exists payment_provider text,
  add column if not exists payment_ref      text,
  add column if not exists paid_at          timestamptz;

comment on column public.orders.payment_status is
  'Whether the money has arrived. Independent of status, which is the kitchen.';
comment on column public.orders.payment_ref is
  'The gateway''s own transaction id. Unique per provider, so a replayed '
  'webhook cannot credit the same order twice.';

-- Gateways retry callbacks, and will happily deliver the same transaction more
-- than once. This index turns a replay into a no-op rather than a second credit.
create unique index if not exists orders_payment_ref_idx
  on public.orders (payment_provider, payment_ref)
  where payment_ref is not null;

-- Only the webhook may mark an order paid, and the webhook runs as service_role.
--
-- The guard is `payment_status <> 'paid'`: once an order is paid, nothing this
-- function receives can change that. A late "failed" callback arriving after a
-- successful one must not undo the payment.
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_provider text,
  p_ref      text,
  p_success  boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set payment_status   = case when p_success then 'paid' else 'failed' end,
         payment_provider = p_provider,
         payment_ref      = p_ref,
         paid_at          = case when p_success then now() else null end,
         -- Paying is what confirms an order; the kitchen takes it from there.
         status           = case
                              when p_success and status = 'pending' then 'confirmed'
                              else status
                            end
   where id = p_order_id
     and payment_status <> 'paid';
end;
$$;

-- Nobody but the webhook. `anon` holding this would be a free-orders button.
revoke all on function public.mark_order_paid(uuid, text, text, boolean) from public;
revoke all on function public.mark_order_paid(uuid, text, text, boolean) from anon;
revoke all on function public.mark_order_paid(uuid, text, text, boolean) from authenticated;
grant execute on function public.mark_order_paid(uuid, text, text, boolean) to service_role;
