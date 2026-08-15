-- SEALTHAI v1.29
-- Secure product/category image uploads by keeping each shop under its own folder.

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

drop policy if exists product_images_shop_select on storage.objects;
drop policy if exists product_images_shop_insert on storage.objects;
drop policy if exists product_images_shop_update on storage.objects;
drop policy if exists product_images_shop_delete on storage.objects;

create policy product_images_shop_select
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-images'
  and (
    exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.shop_members m
      where m.shop_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
        and coalesce(m.active, true)
    )
  )
);

create policy product_images_shop_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (
    exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.shop_members m
      where m.shop_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
        and coalesce(m.active, true)
        and (
          m.role = 'admin'
          or coalesce(m.permissions ->> 'products', 'false') = 'true'
        )
    )
  )
);

create policy product_images_shop_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and (
    exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.shop_members m
      where m.shop_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
        and coalesce(m.active, true)
        and (
          m.role = 'admin'
          or coalesce(m.permissions ->> 'products', 'false') = 'true'
        )
    )
  )
)
with check (
  bucket_id = 'product-images'
  and (
    exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.shop_members m
      where m.shop_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
        and coalesce(m.active, true)
        and (
          m.role = 'admin'
          or coalesce(m.permissions ->> 'products', 'false') = 'true'
        )
    )
  )
);

create policy product_images_shop_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (
    exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.shop_members m
      where m.shop_id::text = (storage.foldername(name))[1]
        and m.user_id = auth.uid()
        and coalesce(m.active, true)
        and (
          m.role = 'admin'
          or coalesce(m.permissions ->> 'products', 'false') = 'true'
        )
    )
  )
);
