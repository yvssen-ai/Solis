-- The single writable entry point for orders.
--
-- SECURITY DEFINER is deliberate and is the reason clients hold no INSERT
-- privilege on orders or order_items: if they did, they could also choose their
-- own total. The trade-off of DEFINER is that RLS no longer applies inside the
-- body, so this function has to do by hand what the policies would have done —
-- namely bind the order to auth.uid() and honour item availability. Both are
-- done explicitly below.
--
-- The client sends only { menu_item_id, quantity }. Names and prices are read
-- from the menu table, so a tampered request cannot buy a 1450 EGP bag of beans
-- for one piastre.
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
  v_lines     jsonb;
  v_subtotal  integer;
  v_resolved  integer;
  v_requested integer;
  v_order     public.orders;
begin
  -- Identity comes from the session, never from a parameter.
  if v_uid is null then
    raise exception 'You must be signed in to place an order' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty' using errcode = '23514';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'That is too many separate items for one order' using errcode = '23514';
  end if;

  if length(btrim(coalesce(p_customer_name, ''))) = 0 then
    raise exception 'A name is required' using errcode = '23514';
  end if;

  if length(btrim(coalesce(p_customer_phone, ''))) = 0 then
    raise exception 'A phone number is required' using errcode = '23514';
  end if;

  if p_fulfilment not in ('pickup', 'delivery') then
    raise exception 'Unknown fulfilment type: %', p_fulfilment using errcode = '23514';
  end if;

  if p_fulfilment = 'delivery' and length(btrim(coalesce(p_address, ''))) = 0 then
    raise exception 'Delivery orders need an address' using errcode = '23514';
  end if;

  -- Duplicate lines for the same item collapse into one, so sending the same
  -- id three times means quantity 3 rather than three separate rows.
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
        (elem ->> 'menu_item_id')::uuid   as menu_item_id,
        sum((elem ->> 'quantity')::integer) as quantity
      from jsonb_array_elements(p_items) as elem
      group by 1
    ) w
    join public.menu_items mi      on mi.id = w.menu_item_id
    join public.menu_categories c  on c.id = mi.category_id
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
    v_uid,
    btrim(p_customer_name),
    btrim(p_customer_phone),
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

revoke all on function public.place_order(jsonb, text, text, text, text, text) from public;
grant execute on function public.place_order(jsonb, text, text, text, text, text) to authenticated;
