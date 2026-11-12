-- ============================================================================
-- MIGRATION: Add delivery_date to orders table (v3.46)
-- Run this in Supabase SQL Editor if you want orders to store delivery_date natively in the database
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT CURRENT_DATE;

-- Ensure permissions for web client
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
