-- SEALTHAI v1.37 — CRM, Multi-Tier Pricing & B2B Sales Management Migration
-- Run this in Supabase Dashboard > SQL Editor.

-- 1. Create table for Customer Master
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  code text, -- e.g. CUST-0001
  name text not null,
  customer_type text not null default 'company', -- 'company', 'individual'
  customer_tier text not null default 'retail', -- 'retail', 'technician', 'wholesale', 'factory', 'vip'
  tax_id text,
  branch_code text default '00000', -- 00000 = Head Office
  billing_address text,
  shipping_address text,
  phone text,
  email text,
  line_id text,
  credit_term_days integer not null default 0, -- 0, 15, 30, 45, 60, 90
  credit_limit numeric(14,2) not null default 0, -- 0 = No credit limit set
  salesperson_id uuid,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, name)
);

-- 2. Create table for Customer Contacts
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

-- 3. Create table for Multi-Tier & Volume Pricing
create table if not exists public.customer_tier_pricing (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_tier text not null, -- 'retail', 'technician', 'wholesale', 'factory', 'vip'
  min_qty integer not null default 1, -- 1, 10, 50, 100+
  tier_price numeric(12,2) not null,
  discount_pct numeric(5,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, product_id, customer_tier, min_qty)
);

-- 4. Add columns to quotations for Deal Pipeline
alter table public.quotations
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_tier text default 'retail',
  add column if not exists deal_stage text default 'draft', -- 'draft', 'sent', 'followup', 'won', 'lost'
  add column if not exists followup_date date,
  add column if not exists lost_reason text,
  add column if not exists deal_notes text;

-- 5. Add columns to orders for B2B Tracking
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists customer_tier text default 'retail',
  add column if not exists credit_term_days integer default 0,
  add column if not exists due_date date,
  add column if not exists tax_id text,
  add column if not exists branch_code text default '00000';

-- 6. Indexes for fast search
create index if not exists idx_customers_shop_tier on public.customers(shop_id, customer_tier);
create index if not exists idx_customers_shop_name on public.customers(shop_id, name);
create index if not exists idx_tier_pricing_product on public.customer_tier_pricing(shop_id, product_id, customer_tier);
create index if not exists idx_quotations_deal_stage on public.quotations(shop_id, deal_stage);
create index if not exists idx_orders_customer_id on public.orders(shop_id, customer_id);

-- 7. Enable RLS
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
