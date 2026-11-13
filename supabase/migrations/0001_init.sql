-- ════════════════════════════════════════════════════════════════════
--  Baby Shop — full schema
--  Run once in Supabase → SQL Editor (or `supabase db push`).
-- ════════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Dashboard admins (link a Supabase Auth user here to grant access)
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ───────────────────────── settings ─────────────────────────
create table public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

insert into public.settings (key, value) values ('store', '{
  "shop_name": "Haya Baby",
  "tagline": "Soft, safe & sweet things for your little one",
  "instagram": "",
  "whatsapp_contact": "",
  "delivery_fee": 250,
  "free_delivery_over": 5000,
  "low_stock_threshold": 2,
  "payment": {
    "cod": true,
    "jazzcash":  {"enabled": false, "title": "", "number": ""},
    "easypaisa": {"enabled": false, "title": "", "number": ""},
    "bank":      {"enabled": false, "bank_name": "", "title": "", "account": "", "iban": ""}
  }
}'::jsonb);

-- ───────────────────────── catalogue ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
insert into public.categories (name, slug, sort) values
  ('Clothes', 'clothes', 1),
  ('Starter Sets', 'starter-sets', 2),
  ('Blankets & Swaddles', 'blankets-swaddles', 3),
  ('Feeding', 'feeding', 4),
  ('Bath & Care', 'bath-care', 5),
  ('Toys', 'toys', 6),
  ('Accessories', 'accessories', 7);

create type public.product_status as enum ('draft', 'active', 'sold_out', 'hidden');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= 0),
  status public.product_status not null default 'active',
  tags text[] not null default '{}',
  ai_description text,             -- visual description used to match owner photos
  instagram_url text,
  video_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on public.products(status);
create index products_category_idx on public.products(category_id);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null default '',
  color text not null default '',
  sku text unique,
  price integer check (price is null or price >= 0),   -- optional override
  stock integer not null default 0 check (stock >= 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index variants_product_idx on public.variants(product_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  url text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images(product_id);

create type public.movement_source as enum ('whatsapp', 'dashboard', 'order', 'system');

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  change integer not null,
  stock_after integer not null,
  reason text,
  source public.movement_source not null,
  actor text,
  created_at timestamptz not null default now()
);
create index stock_movements_created_idx on public.stock_movements(created_at desc);

-- ───────────────────────── orders ─────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001) unique,
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  notes text,
  payment_method text not null check (payment_method in ('cod', 'jazzcash', 'easypaisa', 'bank')),
  payment_ref text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal integer not null default 0,
  delivery_fee integer not null default 0,
  total integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_created_idx on public.orders(created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.variants(id) on delete set null,
  name text not null,
  size text,
  color text,
  price integer not null,
  qty integer not null check (qty > 0),
  image_url text
);
create index order_items_order_idx on public.order_items(order_id);

-- ───────────────────────── WhatsApp bot ─────────────────────────
create table public.bot_users (
  phone text primary key,          -- digits only with country code, e.g. 923001234567
  name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  notify_orders boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bot_media (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  kind text not null check (kind in ('image', 'video')),
  mime text,
  storage_path text not null,
  url text not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index bot_media_phone_idx on public.bot_media(phone, created_at desc);

create table public.bot_sessions (
  phone text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.bot_actions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  undo jsonb,
  summary text,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'cancelled', 'undone', 'expired')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index bot_actions_phone_idx on public.bot_actions(phone, created_at desc);

-- de-duplicates Meta webhook retries
create table public.wa_processed (
  id text primary key,
  created_at timestamptz not null default now()
);

-- ───────────────────────── stock logic ─────────────────────────
-- Auto-flip a product between active ⇄ sold_out based on total stock.
create or replace function public.refresh_product_status(p_product uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_total int; v_status product_status;
begin
  select status into v_status from products where id = p_product;
  select coalesce(sum(stock), 0) into v_total from variants where product_id = p_product;
  if v_status = 'active' and v_total = 0 then
    update products set status = 'sold_out' where id = p_product;
  elsif v_status = 'sold_out' and v_total > 0 then
    update products set status = 'active' where id = p_product;
  end if;
end $$;

-- Change stock by +/- n and log it. With p_clamp, never goes below 0.
create or replace function public.adjust_stock(
  p_variant uuid, p_change int, p_reason text,
  p_source movement_source, p_actor text default null, p_clamp boolean default false
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_old int; v_new int; v_product uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select stock, product_id into v_old, v_product from variants where id = p_variant for update;
  if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
  v_new := v_old + p_change;
  if v_new < 0 then
    if p_clamp then v_new := 0; else raise exception 'INSUFFICIENT_STOCK'; end if;
  end if;
  update variants set stock = v_new where id = p_variant;
  if v_new <> v_old then
    insert into stock_movements (variant_id, product_id, change, stock_after, reason, source, actor)
    values (p_variant, v_product, v_new - v_old, v_new, p_reason, p_source, p_actor);
  end if;
  perform refresh_product_status(v_product);
  return v_new;
end $$;

-- Set stock to an exact number and log the difference.
create or replace function public.set_stock(
  p_variant uuid, p_stock int, p_reason text,
  p_source movement_source, p_actor text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_old int;
begin
  select stock into v_old from variants where id = p_variant;
  if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
  return public.adjust_stock(p_variant, greatest(p_stock, 0) - v_old, p_reason, p_source, p_actor, true);
end $$;

-- Atomic checkout: validates stock & prices server-side, deducts stock.
create or replace function public.place_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_settings jsonb; v_item jsonb; v record;
  v_order uuid; v_num bigint; v_sub int := 0; v_fee int; v_free int; v_qty int; v_img text;
begin
  if coalesce(jsonb_array_length(p->'items'), 0) = 0 then raise exception 'EMPTY_CART'; end if;
  select value into v_settings from settings where key = 'store';

  insert into orders (customer_name, phone, city, address, notes, payment_method, payment_ref)
  values (p->>'customer_name', p->>'phone', p->>'city', p->>'address',
          nullif(p->>'notes', ''), p->>'payment_method', nullif(p->>'payment_ref', ''))
  returning id, order_number into v_order, v_num;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'BAD_QTY'; end if;

    select va.id, va.stock, va.size, va.color, coalesce(va.price, pr.price) as price,
           pr.id as product_id, pr.name, pr.status
      into v
      from variants va join products pr on pr.id = va.product_id
     where va.id = (v_item->>'variant_id')::uuid
     for update of va;

    if not found or v.status <> 'active' then raise exception 'UNAVAILABLE'; end if;
    if v.stock < v_qty then raise exception 'OUT_OF_STOCK:%', v.name; end if;

    select url into v_img from product_images where product_id = v.product_id order by sort, created_at limit 1;

    insert into order_items (order_id, product_id, variant_id, name, size, color, price, qty, image_url)
    values (v_order, v.product_id, v.id, v.name, nullif(v.size, ''), nullif(v.color, ''), v.price, v_qty, v_img);

    perform adjust_stock(v.id, -v_qty, 'Order #' || v_num, 'order', 'website', false);
    v_sub := v_sub + v.price * v_qty;
  end loop;

  v_fee := coalesce((v_settings->>'delivery_fee')::int, 0);
  v_free := coalesce((v_settings->>'free_delivery_over')::int, 0);
  if v_free > 0 and v_sub >= v_free then v_fee := 0; end if;

  update orders set subtotal = v_sub, delivery_fee = v_fee, total = v_sub + v_fee where id = v_order;
  return jsonb_build_object('id', v_order, 'order_number', v_num, 'total', v_sub + v_fee);
end $$;

-- Cancel an order and put its items back into stock.
create or replace function public.cancel_order(p_order uuid, p_actor text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text; v_num bigint; it record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  select status, order_number into v_status, v_num from orders where id = p_order for update;
  if v_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_status = 'cancelled' then return; end if;
  for it in select * from order_items where order_id = p_order and variant_id is not null loop
    perform adjust_stock(it.variant_id, it.qty, 'Order #' || v_num || ' cancelled', 'order', p_actor, false);
  end loop;
  update orders set status = 'cancelled' where id = p_order;
end $$;

revoke execute on function public.adjust_stock(uuid, int, text, movement_source, text, boolean) from public, anon;
revoke execute on function public.set_stock(uuid, int, text, movement_source, text) from public, anon;
revoke execute on function public.place_order(jsonb) from public, anon, authenticated;
revoke execute on function public.cancel_order(uuid, text) from public, anon;
revoke execute on function public.refresh_product_status(uuid) from public, anon;
grant execute on function public.adjust_stock(uuid, int, text, movement_source, text, boolean) to authenticated, service_role;
grant execute on function public.set_stock(uuid, int, text, movement_source, text) to authenticated, service_role;
grant execute on function public.place_order(jsonb) to service_role;
grant execute on function public.cancel_order(uuid, text) to authenticated, service_role;
grant execute on function public.refresh_product_status(uuid) to authenticated, service_role;

-- ───────────────────────── row level security ─────────────────────────
alter table public.admins          enable row level security;
alter table public.settings        enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.variants        enable row level security;
alter table public.product_images  enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.bot_users       enable row level security;
alter table public.bot_media       enable row level security;
alter table public.bot_sessions    enable row level security;
alter table public.bot_actions     enable row level security;
alter table public.wa_processed    enable row level security;

-- Shoppers can read the live catalogue and public store settings
create policy "public read store settings" on public.settings for select using (key = 'store');
create policy "public read categories" on public.categories for select using (true);
create policy "public read products" on public.products for select
  using (status in ('active', 'sold_out'));
create policy "public read variants" on public.variants for select
  using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active', 'sold_out')));
create policy "public read images" on public.product_images for select
  using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active', 'sold_out')));

-- Admins can do everything in the dashboard
do $$
declare t text;
begin
  foreach t in array array['admins','settings','categories','products','variants','product_images',
                           'stock_movements','orders','order_items','bot_users','bot_actions'] loop
    execute format('create policy "admin all %1$s" on public.%1$I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "admin upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin update product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "admin delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
