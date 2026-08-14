-- SEALTHAI v1.21/v1.22 — Expense Management & Dashboard
-- Run once in Supabase SQL Editor before using the detailed expense fields.

create extension if not exists pgcrypto;

alter table public.expenses
  add column if not exists standardized_category text,
  add column if not exists subcategory text,
  add column if not exists vendor_name text,
  add column if not exists document_no text,
  add column if not exists payment_date date,
  add column if not exists due_date date,
  add column if not exists base_amount numeric(14,2),
  add column if not exists vat_amount numeric(14,2) not null default 0,
  add column if not exists vat_claimable boolean not null default false,
  add column if not exists withholding_tax numeric(14,2) not null default 0,
  add column if not exists paid_amount numeric(14,2) not null default 0,
  add column if not exists payment_status text not null default 'paid',
  add column if not exists payment_method text,
  add column if not exists expense_type text not null default 'operating',
  add column if not exists recurrence text not null default 'one_time',
  add column if not exists channel text,
  add column if not exists project_name text,
  add column if not exists receipt_path text,
  add column if not exists include_in_profit boolean not null default true,
  add column if not exists duplicate_risk boolean not null default false,
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists legacy_category text,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz not null default now();

update public.expenses
set base_amount = coalesce(base_amount, amount),
    paid_amount = case when paid_amount = 0 then coalesce(amount,0) else paid_amount end,
    legacy_category = coalesce(legacy_category, category),
    review_status = coalesce(review_status, 'needs_review')
where base_amount is null
   or legacy_category is null;

alter table public.expenses drop constraint if exists expenses_payment_status_check;
alter table public.expenses add constraint expenses_payment_status_check
  check (payment_status in ('unpaid','partial','paid'));
alter table public.expenses drop constraint if exists expenses_expense_type_check;
alter table public.expenses add constraint expenses_expense_type_check
  check (expense_type in ('operating','inventory','landed_cost','asset','owner_draw','tax','refund'));
alter table public.expenses drop constraint if exists expenses_recurrence_check;
alter table public.expenses add constraint expenses_recurrence_check
  check (recurrence in ('one_time','recurring'));
alter table public.expenses drop constraint if exists expenses_review_status_check;
alter table public.expenses add constraint expenses_review_status_check
  check (review_status in ('needs_review','approved'));

create index if not exists expenses_shop_date_idx on public.expenses(shop_id, expense_date);
create index if not exists expenses_shop_review_idx on public.expenses(shop_id, review_status);
create index if not exists expenses_shop_category_idx on public.expenses(shop_id, standardized_category);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  parent_name text,
  default_type text not null default 'operating',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(shop_id, name)
);

create table if not exists public.expense_budgets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  budget_month date not null,
  category text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_id, budget_month, category)
);

alter table public.expense_categories enable row level security;
alter table public.expense_budgets enable row level security;

drop policy if exists "expense_categories_authenticated" on public.expense_categories;
create policy "expense_categories_authenticated" on public.expense_categories
  for all to authenticated
  using (
    exists (select 1 from public.shops s where s.id = expense_categories.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = expense_categories.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
  )
  with check (
    exists (select 1 from public.shops s where s.id = expense_categories.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = expense_categories.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
  );
drop policy if exists "expense_budgets_authenticated" on public.expense_budgets;
create policy "expense_budgets_authenticated" on public.expense_budgets
  for all to authenticated
  using (
    exists (select 1 from public.shops s where s.id = expense_budgets.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = expense_budgets.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
  )
  with check (
    exists (select 1 from public.shops s where s.id = expense_budgets.shop_id and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id = expense_budgets.shop_id and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "expense_receipts_select" on storage.objects;
create policy "expense_receipts_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'expense-receipts' and (
      exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
      or exists (select 1 from public.shop_members m where m.shop_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid() and coalesce(m.active,true))
    )
  );
drop policy if exists "expense_receipts_insert" on storage.objects;
create policy "expense_receipts_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'expense-receipts' and (
      exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
      or exists (select 1 from public.shop_members m where m.shop_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
    )
  );
drop policy if exists "expense_receipts_update" on storage.objects;
create policy "expense_receipts_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'expense-receipts' and (
    exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
  ))
  with check (bucket_id = 'expense-receipts' and (
    exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
    or exists (select 1 from public.shop_members m where m.shop_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
  ));
drop policy if exists "expense_receipts_delete" on storage.objects;
create policy "expense_receipts_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'expense-receipts' and (
      exists (select 1 from public.shops s where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid())
      or exists (select 1 from public.shop_members m where m.shop_id::text = (storage.foldername(name))[1] and m.user_id = auth.uid() and coalesce(m.active,true) and (m.role = 'admin' or coalesce(m.permissions->>'expenses','false') = 'true'))
    )
  );

-- Suggest a standard category for old rows, but keep review_status as needs_review.
-- Users approve or change these suggestions from the Expense Review screen.
update public.expenses
set standardized_category = case
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(facebook|google|ads|โฆษณา|การตลาด)' then 'การตลาดและโฆษณา'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(แพค|แพ็ก|บรรจุ|จัดส่ง|ขนส่ง.*ลูกค้า)' then 'บรรจุภัณฑ์และการจัดส่ง'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(server|software|ai|it|ระบบ|hosting|domain)' then 'เทคโนโลยีและซอฟต์แวร์'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(น้ำมัน|ev|รถ|เดินทาง|ที่พัก)' then 'เดินทางและยานพาหนะ'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(น้ำ|ไฟ|เช่า|สำนักงาน)' then 'สถานที่และสาธารณูปโภค'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(เงินเดือน|ค่าจ้าง|โบนัส|พนักงาน)' then 'บุคลากรและค่าจ้าง'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(ธนาคาร|ดอกเบี้ย|ค่าธรรมเนียม)' then 'ธนาคารและการเงิน'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(ภาษี|ราชการ|ใบอนุญาต)' then 'ภาษีและค่าธรรมเนียมราชการ'
  when lower(coalesce(category,'') || ' ' || coalesce(note,'')) ~ '(กระดาษ|เอกสาร|อุปกรณ์)' then 'สำนักงานและบริหาร'
  else 'ค่าใช้จ่ายดำเนินงานอื่น'
end
where standardized_category is null;
