-- SEALTHAI v1.36 — Multi-Marketplace Sync Hub Migration
-- Run this in Supabase SQL Editor to support Marketplace integration, SKU mappings, and order tracking.

-- 1. Create table for Platform SKU Mappings
create table if not exists public.marketplace_sku_mappings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  channel text not null, -- 'Shopee', 'Lazada', 'TikTok', 'LINE', etc.
  platform_sku text not null,
  platform_item_name text,
  product_id uuid not null references public.products(id) on delete cascade,
  multiplier numeric(10,2) not null default 1.0, -- e.g. pack of 10 = 10
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, channel, platform_sku)
);

-- 2. Add columns to orders for Marketplace tracking
alter table public.orders
  add column if not exists platform_order_id text,
  add column if not exists platform_status text,
  add column if not exists platform_fee numeric(12,2) default 0,
  add column if not exists shipping_provider text,
  add column if not exists buyer_username text,
  add column if not exists sync_batch_id text,
  add column if not exists stock_deducted boolean default false;

-- 3. Add index for faster search and duplicate checking
create index if not exists idx_orders_shop_platform_id on public.orders(shop_id, platform_order_id);
create index if not exists idx_orders_shop_channel_date on public.orders(shop_id, channel, order_date);
create index if not exists idx_marketplace_sku_mappings_search on public.marketplace_sku_mappings(shop_id, channel, platform_sku);

-- 4. Enable Row Level Security (RLS) for marketplace_sku_mappings
alter table public.marketplace_sku_mappings enable row level security;

drop policy if exists "marketplace_sku_mappings_authenticated" on public.marketplace_sku_mappings;
create policy "marketplace_sku_mappings_authenticated"
on public.marketplace_sku_mappings
for all
to authenticated, anon
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
