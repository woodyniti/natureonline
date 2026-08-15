-- SEALTHAI v1.33
-- Product/category image Storage RLS.
-- Run this whole file once in Supabase Dashboard > SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- SECURITY DEFINER is intentional: a Storage policy must be able to verify
-- shops/shop_members even when those tables have their own RLS policies.
create or replace function public.can_manage_product_images(target_shop_id text)
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
          and (
            lower(coalesce(m.role, '')) in ('owner', 'admin')
            or lower(coalesce(m.permissions ->> 'products', 'false')) in ('true', '1', 'yes')
          )
      )
    );
$$;

revoke all on function public.can_manage_product_images(text) from public;
grant execute on function public.can_manage_product_images(text) to authenticated;

drop policy if exists product_images_shop_select on storage.objects;
drop policy if exists product_images_shop_insert on storage.objects;
drop policy if exists product_images_shop_update on storage.objects;
drop policy if exists product_images_shop_delete on storage.objects;

create policy product_images_shop_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-images'
  and public.can_manage_product_images((storage.foldername(name))[1])
);

create policy product_images_shop_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.can_manage_product_images((storage.foldername(name))[1])
);

create policy product_images_shop_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.can_manage_product_images((storage.foldername(name))[1])
)
with check (
  bucket_id = 'product-images'
  and public.can_manage_product_images((storage.foldername(name))[1])
);

create policy product_images_shop_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.can_manage_product_images((storage.foldername(name))[1])
);
