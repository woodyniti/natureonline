-- ═══════════════════════════════════════════════════════════════════
-- SEALTHAI v1.36 + v1.37 + v1.38 ALL-IN-ONE SQL MIGRATION
-- Run this entire script in Supabase Dashboard > SQL Editor (1-Click Run)
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- PART 1: v1.36 Marketplace Sync Hub
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.marketplace_sku_mappings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  channel text not null,
  platform_sku text not null,
  platform_item_name text,
  product_id uuid not null references public.products(id) on delete cascade,
  multiplier numeric(10,2) not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, channel, platform_sku)
);

alter table public.orders
  add column if not exists platform_order_id text,
  add column if not exists platform_status text,
  add column if not exists platform_fee numeric(12,2) default 0,
  add column if not exists shipping_provider text,
  add column if not exists buyer_username text,
  add column if not exists sync_batch_id text,
  add column if not exists stock_deducted boolean default false;

create index if not exists idx_orders_shop_platform_id on public.orders(shop_id, platform_order_id);
create index if not exists idx_orders_shop_channel_date on public.orders(shop_id, channel, order_date);
create index if not exists idx_marketplace_sku_mappings_search on public.marketplace_sku_mappings(shop_id, channel, platform_sku);

alter table public.marketplace_sku_mappings enable row level security;
drop policy if exists "marketplace_sku_mappings_authenticated" on public.marketplace_sku_mappings;
create policy "marketplace_sku_mappings_authenticated" on public.marketplace_sku_mappings
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = marketplace_sku_mappings.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = marketplace_sku_mappings.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = marketplace_sku_mappings.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = marketplace_sku_mappings.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );

-- ─────────────────────────────────────────────────────────────────
-- PART 2: v1.37 Customer Master, CRM & Multi-Tier Pricing
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text,
  name text not null,
  customer_type text not null default 'company',
  customer_tier text not null default 'retail',
  tax_id text,
  branch_code text default '00000',
  billing_address text,
  shipping_address text,
  phone text,
  email text,
  line_id text,
  credit_term_days integer not null default 0,
  credit_limit numeric(14,2) not null default 0,
  salesperson_id uuid,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, name)
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  position text,
  phone text,
  email text,
  line_id text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_tier_pricing (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_tier text not null,
  min_qty integer not null default 1,
  tier_price numeric(12,2) not null,
  discount_pct numeric(5,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, product_id, customer_tier, min_qty)
);

alter table public.quotations
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_tier text default 'retail',
  add column if not exists deal_stage text default 'draft',
  add column if not exists followup_date date,
  add column if not exists lost_reason text,
  add column if not exists deal_notes text;

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_tier text default 'retail',
  add column if not exists credit_term_days integer default 0,
  add column if not exists due_date date,
  add column if not exists tax_id text,
  add column if not exists branch_code text default '00000';

create index if not exists idx_customers_shop_tier on public.customers(shop_id, customer_tier);
create index if not exists idx_customers_shop_name on public.customers(shop_id, name);
create index if not exists idx_tier_pricing_product on public.customer_tier_pricing(shop_id, product_id, customer_tier);
create index if not exists idx_quotations_deal_stage on public.quotations(shop_id, deal_stage);
create index if not exists idx_orders_customer_id on public.orders(shop_id, customer_id);

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_tier_pricing enable row level security;

drop policy if exists "customers_authenticated" on public.customers;
create policy "customers_authenticated" on public.customers
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = customers.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customers.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = customers.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customers.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );

drop policy if exists "customer_contacts_authenticated" on public.customer_contacts;
create policy "customer_contacts_authenticated" on public.customer_contacts
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = customer_contacts.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_contacts.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = customer_contacts.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_contacts.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );

drop policy if exists "customer_tier_pricing_authenticated" on public.customer_tier_pricing;
create policy "customer_tier_pricing_authenticated" on public.customer_tier_pricing
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = customer_tier_pricing.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_tier_pricing.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = customer_tier_pricing.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_tier_pricing.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );

-- ─────────────────────────────────────────────────────────────────
-- PART 3: v1.38 Executive AI & Predictive Intelligence
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.product_cross_sell_pairs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id_a uuid not null references public.products(id) on delete cascade,
  product_id_b uuid not null references public.products(id) on delete cascade,
  co_occurrence_count integer not null default 1,
  confidence_pct numeric(5,2) not null default 0,
  recommended_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, product_id_a, product_id_b)
);

create table if not exists public.customer_followup_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  followup_date date not null default current_date,
  contact_channel text default 'phone',
  followup_reason text default 'churn_prevention',
  result_status text default 'pending',
  notes text,
  salesperson_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_cross_sell_prod_a on public.product_cross_sell_pairs(shop_id, product_id_a);
create index if not exists idx_followup_customer on public.customer_followup_logs(shop_id, customer_id, followup_date);

alter table public.product_cross_sell_pairs enable row level security;
alter table public.customer_followup_logs enable row level security;

drop policy if exists "product_cross_sell_pairs_auth" on public.product_cross_sell_pairs;
create policy "product_cross_sell_pairs_auth" on public.product_cross_sell_pairs
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = product_cross_sell_pairs.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = product_cross_sell_pairs.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = product_cross_sell_pairs.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = product_cross_sell_pairs.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );

drop policy if exists "customer_followup_logs_auth" on public.customer_followup_logs;
create policy "customer_followup_logs_auth" on public.customer_followup_logs
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = customer_followup_logs.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_followup_logs.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = customer_followup_logs.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_followup_logs.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );
