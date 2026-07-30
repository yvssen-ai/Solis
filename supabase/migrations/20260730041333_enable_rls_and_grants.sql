-- RLS on every table in public. Tables in an exposed schema are reachable
-- through the Data API as soon as anon/authenticated have privileges, so RLS is
-- what actually decides which rows anyone sees.

alter table public.menu_categories enable row level security;
alter table public.menu_items      enable row level security;
alter table public.profiles        enable row level security;
alter table public.staff           enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;

-- ---------------------------------------------------------------------------
-- Staff membership
-- ---------------------------------------------------------------------------

-- A user may read their own staff row and nothing else. That single policy is
-- what lets is_staff() below work as SECURITY INVOKER, so no part of this
-- schema needs SECURITY DEFINER to answer "am I staff?".
create policy "read own staff row"
  on public.staff for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s where s.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Menu: public read, and only what is actually on sale
-- ---------------------------------------------------------------------------

-- Filtering in the policy rather than the client means an unavailable item is
-- absent from the API entirely, so it cannot be ordered even by a crafted
-- request. Staff edit the menu through the dashboard, which bypasses RLS.
create policy "anyone can read active categories"
  on public.menu_categories for select
  to anon, authenticated
  using (is_active);

create policy "anyone can read available items"
  on public.menu_items for select
  to anon, authenticated
  using (
    is_available
    and exists (
      select 1 from public.menu_categories c
      where c.id = menu_items.category_id and c.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- Profiles: strictly your own
-- ---------------------------------------------------------------------------

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "create own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Both USING and WITH CHECK: USING alone would let a user rewrite the row's id
-- and hand their profile to somebody else.
create policy "update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Orders: readable by their owner or staff, writable by nobody
-- ---------------------------------------------------------------------------

-- There is deliberately no INSERT policy for orders or order_items, and no
-- INSERT privilege granted below. If clients could insert orders directly they
-- could also choose their own total_piastres. Every order is created through
-- public.place_order(), which derives the price from the menu table.
create policy "read own orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id or public.is_staff());

create policy "staff advance order status"
  on public.orders for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "read own order items"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and ((select auth.uid()) = o.user_id or public.is_staff())
    )
  );

-- ---------------------------------------------------------------------------
-- Data API privileges. Newly created tables are not necessarily exposed, so
-- grant explicitly — and grant only what each role genuinely needs.
-- ---------------------------------------------------------------------------

grant select on public.menu_categories to anon, authenticated;
grant select on public.menu_items      to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select                 on public.staff    to authenticated;

grant select on public.orders      to authenticated;
grant select on public.order_items to authenticated;

-- Column-level: even a staff member can only move an order along, not rewrite
-- what it cost. RLS chooses the rows; this chooses the columns.
grant update (status) on public.orders to authenticated;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, so tighten it.
revoke all on function public.is_staff()          from public;
revoke all on function public.touch_updated_at()  from public;
grant execute on function public.is_staff() to authenticated;
