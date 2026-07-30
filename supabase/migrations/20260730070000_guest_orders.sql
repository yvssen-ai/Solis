-- Ordering without an account.
--
-- Requiring a sign-in meant every customer had to receive an email and type a
-- six-digit code before they could buy a coffee. That needs working auth email,
-- which needs custom SMTP, and it is friction in the wrong place for a cafe: the
-- counter needs a name and a number, not an identity.
--
-- So orders no longer belong to a user. What replaces ownership is a random
-- token minted per order and handed back to whoever placed it, which is how they
-- — and only they — can look it up again afterwards. It is a receipt number, not
-- a login.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.orders alter column user_id drop not null;

alter table public.orders
  add column if not exists public_token uuid not null default gen_random_uuid();

-- 122 random bits. Long enough that guessing one is not a strategy, which is
-- what lets get_orders() below answer to anybody holding it.
create unique index if not exists orders_public_token_idx
  on public.orders (public_token);

-- Supports the rate-limit lookup in place_order().
create index if not exists orders_phone_recent_idx
  on public.orders (customer_phone, created_at desc);

comment on column public.orders.public_token is
  'Receipt token. Returned once to the client that placed the order and stored '
  'on their device; the only way a guest can read the order back.';

-- ---------------------------------------------------------------------------
-- place_order: no longer requires a session
-- ---------------------------------------------------------------------------

create or replace function public.place_order(
  p_items          jsonb,
  p_customer_name  text,
  p_customer_phone text,
  p_fulfilment     text default 'pickup',
  p_address        text default null,
  p_notes          text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_phone     text := btrim(coalesce(p_customer_phone, ''));
  v_lines     jsonb;
  v_subtotal  integer;
  v_resolved  integer;
  v_requested integer;
  v_order     public.orders;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty' using errcode = '23514';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'That is too many separate items for one order' using errcode = '23514';
  end if;

  if length(btrim(coalesce(p_customer_name, ''))) = 0 then
    raise exception 'A name is required' using errcode = '23514';
  end if;

  if length(v_phone) < 6 then
    raise exception 'A phone number is required' using errcode = '23514';
  end if;

  if p_fulfilment not in ('pickup', 'delivery') then
    raise exception 'Unknown fulfilment type: %', p_fulfilment using errcode = '23514';
  end if;

  if p_fulfilment = 'delivery' and length(btrim(coalesce(p_address, ''))) = 0 then
    raise exception 'Delivery orders need an address' using errcode = '23514';
  end if;

  -- Anyone on the internet can now reach this function, so it needs a limit of
  -- its own. Ownership used to be the limit: an order had to belong to a signed-
  -- in user. The phone number is the closest thing left to an identity, and a
  -- real customer does not place six orders in ten minutes.
  if (
    select count(*) from public.orders o
    where o.customer_phone = v_phone
      and o.created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'That is a lot of orders at once. Give us a few minutes, or call the shop.'
      using errcode = '23514';
  end if;

  -- Duplicate lines for the same item collapse into one, so sending the same id
  -- three times means quantity 3 rather than three separate rows.
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'menu_item_id',        r.menu_item_id,
          'name',                r.name,
          'unit_price_piastres', r.price_piastres,
          'quantity',            r.quantity,
          'line_total_piastres', r.line_total_piastres
        )
      ),
      '[]'::jsonb
    ),
    coalesce(sum(r.line_total_piastres), 0),
    count(*)
  into v_lines, v_subtotal, v_resolved
  from (
    select
      w.menu_item_id,
      w.quantity,
      mi.name,
      mi.price_piastres,
      mi.price_piastres * w.quantity as line_total_piastres
    from (
      select
        (elem ->> 'menu_item_id')::uuid     as menu_item_id,
        sum((elem ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) as elem
      group by 1
    ) w
    join public.menu_items mi     on mi.id = w.menu_item_id
    join public.menu_categories c on c.id = mi.category_id
    where mi.is_available
      and c.is_active
      and w.quantity between 1 and 99
  ) r;

  select count(distinct (elem ->> 'menu_item_id')::uuid)
  into v_requested
  from jsonb_array_elements(p_items) as elem;

  -- Anything that failed to resolve was unavailable, off-menu, or had a silly
  -- quantity. Refuse the whole order rather than quietly dropping a line.
  if v_resolved is distinct from v_requested then
    raise exception 'One or more items are no longer available' using errcode = '23514';
  end if;

  insert into public.orders (
    user_id, customer_name, customer_phone, fulfilment, address, notes,
    subtotal_piastres, total_piastres
  )
  values (
    v_uid,                       -- null for a guest, which is the normal case now
    btrim(p_customer_name),
    v_phone,
    p_fulfilment,
    nullif(btrim(coalesce(p_address, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_subtotal,
    v_subtotal
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, menu_item_id, name_snapshot, unit_price_piastres, quantity, line_total_piastres
  )
  select
    v_order.id, l.menu_item_id, l.name, l.unit_price_piastres, l.quantity, l.line_total_piastres
  from jsonb_to_recordset(v_lines) as l(
    menu_item_id uuid,
    name text,
    unit_price_piastres integer,
    quantity integer,
    line_total_piastres integer
  );

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_orders: read back what you placed, using the tokens you were given
-- ---------------------------------------------------------------------------

create or replace function public.get_orders(p_tokens uuid[])
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(payload order by created_at desc), '[]'::jsonb)
  from (
    select
      o.created_at,
      jsonb_build_object(
        'order_number',   o.order_number,
        'status',         o.status,
        'fulfilment',     o.fulfilment,
        'total_piastres', o.total_piastres,
        'created_at',     o.created_at,
        'notes',          o.notes,
        'items', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'name',                i.name_snapshot,
                'quantity',            i.quantity,
                'line_total_piastres', i.line_total_piastres
              )
              order by i.name_snapshot
            ),
            '[]'::jsonb
          )
          from public.order_items i
          where i.order_id = o.id
        )
      ) as payload
    from public.orders o
    where p_tokens is not null
      and array_length(p_tokens, 1) between 1 and 25
      and o.public_token = any (p_tokens)
    order by o.created_at desc
    limit 25
  ) t;
$$;

-- Note what is absent: phone, address, and the customer's name. A token is
-- enough to watch an order's progress, and no more than that — so a device left
-- unlocked on a counter does not hand over someone's home address.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function public.place_order(jsonb, text, text, text, text, text) from public;
revoke all on function public.get_orders(uuid[]) from public;

-- Both roles: a guest is `anon`, and a signed-in staff member ordering their own
-- lunch is `authenticated`.
grant execute on function public.place_order(jsonb, text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.get_orders(uuid[]) to anon, authenticated;

-- Direct table access is unchanged and still closed: anon holds no privilege on
-- orders or order_items at all, and the RLS policies still resolve to "your own
-- rows, or every row if you are staff". Guests never touch the tables — both
-- functions above are SECURITY DEFINER and are the entire public surface.
