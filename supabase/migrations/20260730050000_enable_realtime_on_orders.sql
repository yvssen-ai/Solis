-- Live order status.
--
-- Postgres only sends row changes to Realtime for tables in the
-- supabase_realtime publication, and Supabase does not add new tables to it.
-- Without this, subscribing to `orders` succeeds and then never fires — the
-- quietest kind of bug, because nothing is broken enough to log.
--
-- Realtime applies the table's RLS policies to each subscriber before sending,
-- so "read own orders" still holds: a customer is pushed their own rows, staff
-- are pushed all of them.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- REPLICA IDENTITY FULL so the old row is present on UPDATE. The default
-- (primary key only) is enough to know *that* an order changed, which is all the
-- client needs here, but the full row is what lets Realtime evaluate RLS against
-- the pre-update state as well — without it an update that moves a row out of a
-- subscriber's visibility is delivered as an unhelpful partial payload.
alter table public.orders replica identity full;
