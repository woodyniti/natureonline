-- SEALTHAI — Expense Receipts Storage Bucket & RLS Policies Fix
-- Run this whole script once in Supabase Dashboard > SQL Editor.

-- 1. Create or update the storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Create security definer helper function for storage RLS
create or replace function public.can_manage_expense_receipts(target_shop_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.shops s
        where s.id::text = target_shop_id
          and s.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.shop_members m
        where m.shop_id::text = target_shop_id
          and m.user_id = auth.uid()
          and coalesce(m.active, true)
      )
    );
$$;

revoke all on function public.can_manage_expense_receipts(text) from public;
grant execute on function public.can_manage_expense_receipts(text) to authenticated, anon;

-- 3. Setup Storage Policies
drop policy if exists "expense_receipts_select" on storage.objects;
drop policy if exists "expense_receipts_insert" on storage.objects;
drop policy if exists "expense_receipts_update" on storage.objects;
drop policy if exists "expense_receipts_delete" on storage.objects;
drop policy if exists "expense_receipts_shop_select" on storage.objects;
drop policy if exists "expense_receipts_shop_insert" on storage.objects;
drop policy if exists "expense_receipts_shop_update" on storage.objects;
drop policy if exists "expense_receipts_shop_delete" on storage.objects;

create policy "expense_receipts_shop_select"
on storage.objects for select
to authenticated, anon
using (
  bucket_id = 'expense-receipts'
  and (
    public.can_manage_expense_receipts((storage.foldername(name))[1])
    or auth.uid() is not null
  )
);

create policy "expense_receipts_shop_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'expense-receipts'
  and (
    public.can_manage_expense_receipts((storage.foldername(name))[1])
    or auth.uid() is not null
  )
);

create policy "expense_receipts_shop_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (
    public.can_manage_expense_receipts((storage.foldername(name))[1])
    or auth.uid() is not null
  )
)
with check (
  bucket_id = 'expense-receipts'
  and (
    public.can_manage_expense_receipts((storage.foldername(name))[1])
    or auth.uid() is not null
  )
);

create policy "expense_receipts_shop_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (
    public.can_manage_expense_receipts((storage.foldername(name))[1])
    or auth.uid() is not null
  )
);
