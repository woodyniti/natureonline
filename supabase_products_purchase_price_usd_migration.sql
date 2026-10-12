-- ============================================================================
-- MIGRATION: Add purchase_price_usd to products table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price_usd numeric(12,4);

-- Ensure permissions for web app
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;

-- Populate existing products from application_note tags if any
UPDATE public.products
SET purchase_price_usd = NULLIF(substring(application_note from '\[(?:USD_BUY|USD|BUY_USD):\s*([0-9.]+)\]'), '')::numeric
WHERE (purchase_price_usd IS NULL OR purchase_price_usd = 0)
  AND application_note ~ '\[(?:USD_BUY|USD|BUY_USD):\s*[0-9.]+\]';
