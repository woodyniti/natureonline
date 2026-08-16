-- SEALTHAI — Fix Row-Level Security (RLS) for ar_invoices and ar_payments
-- Run this in Supabase Dashboard > SQL Editor.

-- 1. Ensure table columns exist
create table if not exists public.ar_invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  ar_no text not null,
  ar_date date not null default current_date,
  due_date date,
  order_id uuid references public.orders(id) on delete set null,
  customer_name text,
  customer_phone text,
  total_amount numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  status text not null default 'unpaid', -- 'unpaid', 'partial', 'paid', 'cancelled'
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ar_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  ar_id uuid not null references public.ar_invoices(id) on delete cascade,
  pay_date date not null default current_date,
  amount numeric(14,2) not null,
  method text default 'โอนเงิน',
  slip_path text,
  note text,
  created_at timestamptz not null default now()
);

-- 2. Enable RLS
alter table public.ar_invoices enable row level security;
alter table public.ar_payments enable row level security;

-- 3. Clean and recreate policies for ar_invoices
drop policy if exists "ar_invoices_authenticated" on public.ar_invoices;
drop policy if exists "ar_invoices_select" on public.ar_invoices;
drop policy if exists "ar_invoices_insert" on public.ar_invoices;
drop policy if exists "ar_invoices_update" on public.ar_invoices;
drop policy if exists "ar_invoices_delete" on public.ar_invoices;

create policy "ar_invoices_all_policy"
on public.ar_invoices
for all
to authenticated, anon
using (
  exists (select 1 from public.shops s where s.id = ar_invoices.shop_id and s.owner_id = auth.uid())
  or exists (select 1 from public.shop_members m where m.shop_id = ar_invoices.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
  or auth.uid() is not null
)
with check (
  exists (select 1 from public.shops s where s.id = ar_invoices.shop_id and s.owner_id = auth.uid())
  or exists (select 1 from public.shop_members m where m.shop_id = ar_invoices.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
  or auth.uid() is not null
);

-- 4. Clean and recreate policies for ar_payments
drop policy if exists "ar_payments_authenticated" on public.ar_payments;
drop policy if exists "ar_payments_select" on public.ar_payments;
drop policy if exists "ar_payments_insert" on public.ar_payments;
drop policy if exists "ar_payments_update" on public.ar_payments;
drop policy if exists "ar_payments_delete" on public.ar_payments;

create policy "ar_payments_all_policy"
on public.ar_payments
for all
to authenticated, anon
using (
  exists (select 1 from public.shops s where s.id = ar_payments.shop_id and s.owner_id = auth.uid())
  or exists (select 1 from public.shop_members m where m.shop_id = ar_payments.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
  or auth.uid() is not null
)
with check (
  exists (select 1 from public.shops s where s.id = ar_payments.shop_id and s.owner_id = auth.uid())
  or exists (select 1 from public.shop_members m where m.shop_id = ar_payments.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
  or auth.uid() is not null
);
