-- v3.29: one employee record may be linked to one Supabase Auth account.
-- Run in Supabase SQL Editor after taking a database backup.
-- Existing employee rows are deliberately left unlinked: names are not unique identifiers.
alter table public.employees
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists employees_user_id_unique
  on public.employees(user_id) where user_id is not null;

create index if not exists employees_shop_user_idx
  on public.employees(shop_id, user_id);

-- Protect identity and salary records. The function must be created by the
-- database owner in SQL Editor so it can check membership without RLS recursion.
create or replace function public.sealthai_can_manage_members(target_shop uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.shops s
    where s.id = target_shop and s.owner_id = (select auth.uid()))
    or exists(select 1 from public.shop_members m
      where m.shop_id = target_shop and m.user_id = (select auth.uid())
        and m.active = true and (m.role = 'admin' or m.permissions->>'users' = 'true'));
$$;
revoke all on function public.sealthai_can_manage_members(uuid) from public, anon;
grant execute on function public.sealthai_can_manage_members(uuid) to authenticated;

revoke all on table public.shop_members, public.employees from anon;
revoke insert, update, delete on table public.shop_members from authenticated;
grant select on table public.shop_members to authenticated;
alter table public.shop_members enable row level security;
alter table public.employees enable row level security;

-- Replace any old permissive policies on these two sensitive tables.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('shop_members','employees')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy sealthai_members_read on public.shop_members for select to authenticated
using (user_id = (select auth.uid()) or public.sealthai_can_manage_members(shop_id));

create policy sealthai_employees_read on public.employees for select to authenticated
using (public.sealthai_can_manage_members(shop_id) or exists(
  select 1 from public.shop_members m
    where m.shop_id = employees.shop_id and m.user_id = (select auth.uid()) and m.active = true));

create policy sealthai_employees_insert on public.employees for insert to authenticated
with check (public.sealthai_can_manage_members(shop_id));
create policy sealthai_employees_update on public.employees for update to authenticated
using (public.sealthai_can_manage_members(shop_id))
with check (public.sealthai_can_manage_members(shop_id));
create policy sealthai_employees_delete on public.employees for delete to authenticated
using (public.sealthai_can_manage_members(shop_id));
