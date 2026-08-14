-- SEALTHAI v1.19: รายได้อื่น + ทะเบียนเงินลงทุน
-- รันครั้งเดียวใน Supabase Dashboard > SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  investment_date date not null,
  investment_type text not null default 'other',
  name text not null,
  provider text,
  principal numeric(14,2) not null default 0 check (principal >= 0),
  fees numeric(14,2) not null default 0 check (fees >= 0),
  status text not null default 'active' check (status in ('active','closed','written_off')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  investment_id uuid references public.investments(id) on delete restrict,
  income_date date not null,
  income_type text not null default 'other',
  description text not null,
  gross_amount numeric(14,2) not null default 0 check (gross_amount >= 0),
  principal_return numeric(14,2) not null default 0 check (principal_return >= 0),
  fees numeric(14,2) not null default 0 check (fees >= 0),
  withholding_tax numeric(14,2) not null default 0 check (withholding_tax >= 0),
  net_cash numeric(14,2) not null default 0,
  realized_profit numeric(14,2) not null default 0,
  account_name text,
  reference_no text,
  recurring boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investments_shop_date_idx on public.investments(shop_id, investment_date desc);
create index if not exists other_income_shop_date_idx on public.other_income(shop_id, income_date desc);
create index if not exists other_income_investment_idx on public.other_income(investment_id);

alter table public.investments enable row level security;
alter table public.other_income enable row level security;

-- จำกัดข้อมูลตามร้าน: เจ้าของร้านหรือสมาชิกที่ยัง active เท่านั้น
drop policy if exists "authenticated investments access" on public.investments;
create policy "authenticated investments access" on public.investments
  for all to authenticated
  using (
    exists (select 1 from public.shops s where s.id = investments.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = investments.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'finance','false') = 'true'))
  )
  with check (
    exists (select 1 from public.shops s where s.id = investments.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = investments.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'finance','false') = 'true'))
  );

drop policy if exists "authenticated other income access" on public.other_income;
create policy "authenticated other income access" on public.other_income
  for all to authenticated
  using (
    exists (select 1 from public.shops s where s.id = other_income.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = other_income.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'finance','false') = 'true'))
  )
  with check (
    exists (select 1 from public.shops s where s.id = other_income.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = other_income.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'finance','false') = 'true'))
  );
