-- ====================================================================
-- Supabase Migration: Order Price Change Audit Logs (v3.47)
-- Description: ตารางบันทึกประวัติการเปลี่ยนแปลงราคาและยอดในบิลออเดอร์ (Audit Trail)
-- Run in Supabase SQL Editor
-- ====================================================================

create table if not exists public.order_price_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_no text,
  changed_at timestamptz not null default now(),
  changed_by text,
  old_grand numeric default 0,
  new_grand numeric default 0,
  diff_grand numeric default 0,
  old_subtotal numeric default 0,
  new_subtotal numeric default 0,
  diff_subtotal numeric default 0,
  old_shipping_fee numeric default 0,
  new_shipping_fee numeric default 0,
  old_bill_discount numeric default 0,
  new_bill_discount numeric default 0,
  diffs jsonb default '[]'::jsonb,
  old_items_snapshot jsonb default '[]'::jsonb,
  new_items_snapshot jsonb default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

-- Indexes for high performance lookup
create index if not exists idx_order_price_logs_order_id on public.order_price_logs(order_id);
create index if not exists idx_order_price_logs_changed_at on public.order_price_logs(changed_at desc);
create index if not exists idx_order_price_logs_shop_id on public.order_price_logs(shop_id);

-- RLS & Access Policies
alter table public.order_price_logs enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'order_price_logs'
  loop
    execute format('drop policy if exists %I on public.order_price_logs', p.policyname);
  end loop;
end $$;

create policy "order_price_logs_select" on public.order_price_logs
  for select to authenticated, anon using (true);

create policy "order_price_logs_insert" on public.order_price_logs
  for insert to authenticated, anon with check (true);

grant select, insert on public.order_price_logs to authenticated, anon;
