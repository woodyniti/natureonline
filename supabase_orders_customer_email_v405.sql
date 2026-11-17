-- ============================================================================
-- MIGRATION: Add customer_email to orders table (v4.05)
-- Run this in Supabase SQL Editor if you want orders to store customer_email natively in the database
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Ensure permissions for web client
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
