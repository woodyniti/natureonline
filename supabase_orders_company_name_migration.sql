-- ============================================================================
-- MIGRATION: Add company_name to orders table
-- Run this in Supabase SQL Editor if you want orders to store company_name natively in the database
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Ensure permissions
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
