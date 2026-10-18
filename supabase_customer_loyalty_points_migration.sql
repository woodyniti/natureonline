-- ==============================================================================
-- SEALTHAI CRM & Loyalty Points System (คลับช่าง & สมาชิกร้าน) Migration
-- Run this script in Supabase Dashboard > SQL Editor
-- ==============================================================================

-- 1. เพิ่มคอลัมน์ระบบสะสมแต้มและระดับสมาชิกในตาราง public.customers
alter table public.customers
  add column if not exists code text, -- รหัสสมาชิกช่าง เช่น MC-0001
  add column if not exists points_balance numeric(12,0) not null default 0, -- แต้มคงเหลือปัจจุบัน
  add column if not exists lifetime_points numeric(12,0) not null default 0, -- แต้มสะสมตลอดชีพ
  add column if not exists lifetime_spend numeric(14,2) not null default 0, -- ยอดซื้อสะสมตลอดชีพ
  add column if not exists mechanic_tier text not null default 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
  add column if not exists welcome_bonus_awarded boolean not null default true, -- ได้รับโบนัสเปิดบัตร 50 แต้มแล้ว
  add column if not exists member_joined_date date default current_date;

-- 2. สร้างตารางบันทึกประวัติความเคลื่อนไหวของคะแนนสะสม (Points Ledger)
create table if not exists public.customer_point_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  transaction_type text not null, -- 'earn' (ได้รับจากยอดซื้อ), 'welcome' (โบนัสเปิดบัตร), 'redeem' (แลกของรางวัล), 'adjust' (ปรับยอดโดยแอดมิน), 'refund_revoke' (ดึงแต้มคืนจากการยกเลิก)
  points numeric(12,0) not null, -- บวกหรือลบ
  balance_after numeric(12,0) default 0,
  order_amount numeric(14,2) default 0,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. สร้าง Index เพื่อการค้นหาและประมวลผลที่รวดเร็ว
create index if not exists idx_customers_code on public.customers(shop_id, code);
create index if not exists idx_customers_mechanic_tier on public.customers(shop_id, mechanic_tier);
create index if not exists idx_cust_pt_tx_cust on public.customer_point_transactions(customer_id, created_at desc);
create index if not exists idx_cust_pt_tx_order on public.customer_point_transactions(order_id);

-- 4. ตั้งค่าสิทธิ์ความปลอดภัย RLS (Row Level Security)
alter table public.customer_point_transactions enable row level security;

drop policy if exists "customer_point_transactions_all" on public.customer_point_transactions;
create policy "customer_point_transactions_all" on public.customer_point_transactions
  for all to authenticated, anon
  using (
    exists (select 1 from public.shops s where s.id = customer_point_transactions.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_point_transactions.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  )
  with check (
    exists (select 1 from public.shops s where s.id = customer_point_transactions.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = customer_point_transactions.shop_id and m.user_id = auth.uid() and coalesce(m.active,true))
    or auth.uid() is not null
  );

-- ==============================================================================
-- สรุปกติการะบบคลับช่าง & สะสมแต้ม SEALTHAI
-- 1. ทุกๆ 100 บาท = 1 แต้ม (ปัดเศษลง)
-- 2. โบนัสเปิดเบอร์/สมาชิกใหม่ = 50 แต้มฟรี
-- 3. ระดับสมาชิก 4 ขั้นบันไดจากยอดซื้อสะสม:
--    🥉 Bronze Apprentice: 0 - 2,999 บาท (โค้ด MECHBRONZE)
--    🥈 Silver Mechanic: 3,000 - 9,999 บาท (ลด 3% โค้ด MECHSILVER3)
--    🥇 Gold Master: 10,000 - 29,999 บาท (ลด 5% โค้ด MECHGOLD5)
--    👑 Platinum Pro: 30,000 บาทขึ้นไป (ลด 7% โค้ด MECHPLATINUM7)
-- ==============================================================================
