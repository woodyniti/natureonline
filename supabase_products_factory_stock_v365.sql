-- ============================================================================
-- MIGRATION: Add factory_stock to products table (v3.65)
-- Run this in Supabase SQL Editor to allow products to store factory_stock (Supplier Stock)
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS factory_stock INTEGER DEFAULT 0;

COMMENT ON COLUMN public.products.factory_stock IS
  'สต็อกโรงงาน / Supplier พร้อมขาย';

-- Ensure permissions
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
