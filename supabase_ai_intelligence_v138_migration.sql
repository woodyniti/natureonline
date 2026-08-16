-- SEALTHAI v1.38 — Executive AI & Predictive Intelligence Migration
-- Run this in Supabase SQL Editor.

-- 1. Create table for Product Cross-Sell Pairs (Market Basket Analysis)
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

-- 2. Create table for Customer Follow-up Logs (Win-back & Retention)
create table if not exists public.customer_followup_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  followup_date date not null default current_date,
  contact_channel text default 'phone', -- 'phone', 'line', 'onsite', 'email'
  followup_reason text default 'churn_prevention', -- 'churn_prevention', 'quotation_followup', 'routine_check'
  result_status text default 'pending', -- 'pending', 'interested', 'ordered', 'no_demand', 'switched_supplier'
  notes text,
  salesperson_id uuid,
  created_at timestamptz not null default now()
);

-- 3. Indexes
create index if not exists idx_cross_sell_prod_a on public.product_cross_sell_pairs(shop_id, product_id_a);
create index if not exists idx_followup_customer on public.customer_followup_logs(shop_id, customer_id, followup_date);

-- 4. Enable RLS
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
