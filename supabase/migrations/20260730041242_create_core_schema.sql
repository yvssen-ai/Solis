-- Solis: core schema.
--
-- Money is stored as integer piastres (1 EGP = 100 piastres). Never float for
-- money: 0.1 + 0.2 <> 0.3 in binary floating point, and a cafe bill that is
-- off by a piastre is a bug nobody can explain. The UI divides by 100.

create table public.menu_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null check (length(btrim(name)) > 0),
  tagline     text,
  note        text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.menu_items (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references public.menu_categories(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  price_piastres  integer not null check (price_piastres >= 0),
  meta            text,
  is_signature    boolean not null default false,
  is_available    boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Foreign keys are not indexed automatically; every join and cascade below
-- would otherwise be a sequential scan.
create index menu_items_category_id_idx on public.menu_items (category_id);
create index menu_items_menu_order_idx  on public.menu_items (category_id, sort_order);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Membership of this table is what makes someone staff. Authorization never
-- reads user_metadata, which the user can edit themselves.
create table public.staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create sequence public.order_number_seq;

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique
                        default 'SOL-' || lpad(nextval('public.order_number_seq')::text, 5, '0'),
  user_id             uuid not null references auth.users (id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending','confirmed','preparing','ready','completed','cancelled')),
  fulfilment          text not null default 'pickup'
                        check (fulfilment in ('pickup','delivery')),
  customer_name       text not null check (length(btrim(customer_name)) > 0),
  customer_phone      text not null check (length(btrim(customer_phone)) > 0),
  address             text,
  notes               text,
  subtotal_piastres   integer not null check (subtotal_piastres >= 0),
  total_piastres      integer not null check (total_piastres >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint orders_delivery_needs_address
    check (fulfilment <> 'delivery' or length(btrim(coalesce(address, ''))) > 0)
);

create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index orders_status_idx            on public.orders (status) where status <> 'completed';

create table public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders (id) on delete cascade,
  -- Kept for reporting, but nullable: deleting a menu item must not delete
  -- history. name and price are snapshotted so an old receipt still reads
  -- correctly after the menu changes.
  menu_item_id          uuid references public.menu_items (id) on delete set null,
  name_snapshot         text not null,
  unit_price_piastres   integer not null check (unit_price_piastres >= 0),
  quantity              integer not null check (quantity > 0 and quantity <= 99),
  line_total_piastres   integer not null check (line_total_piastres >= 0)
);

create index order_items_order_id_idx     on public.order_items (order_id);
create index order_items_menu_item_id_idx on public.order_items (menu_item_id);

-- Plain SECURITY INVOKER trigger: it only ever touches the row being written.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger menu_categories_touch before update on public.menu_categories
  for each row execute function public.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
