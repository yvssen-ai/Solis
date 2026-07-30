-- Supabase's default privileges hand anon and authenticated the full set —
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE — on every new
-- table in public, and rely on RLS to hold the line. That mostly works, but it
-- leaves two real problems:
--
--   1. TRUNCATE is not subject to RLS. Verified directly on a scratch table
--      with RLS enabled and no policies at all: TRUNCATE succeeded without
--      error. Any signed-in user could have emptied the menu.
--   2. A table-level UPDATE grant silently overrides the column-level
--      `grant update (status)` below, so "staff may only change the status"
--      was not actually being enforced.
--
-- So: drop everything the client roles were given implicitly, then grant back
-- exactly what each one needs. RLS still decides the rows; this decides whether
-- the verb is available at all.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Menu: read only, and RLS narrows it to what is on sale.
grant select on public.menu_categories to anon, authenticated;
grant select on public.menu_items      to anon, authenticated;

-- Your own profile.
grant select, insert, update on public.profiles to authenticated;

-- Needed so is_staff() can see your own staff row.
grant select on public.staff to authenticated;

-- Orders are readable, never writable from a client: place_order() is the only
-- way in. With table-level UPDATE gone, this column grant now genuinely means
-- staff can advance an order and change nothing else about it.
grant select           on public.orders      to authenticated;
grant update (status)  on public.orders      to authenticated;
grant select           on public.order_items to authenticated;

-- Future tables: TRUNCATE can never be gated by RLS, and clients have no use
-- for REFERENCES or TRIGGER. Leave SELECT/INSERT/UPDATE/DELETE to the normal
-- Supabase pattern so the dashboard's "expose a table" flow still behaves.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
