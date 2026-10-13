-- ============================================================================
-- MIGRATION: Add internal_note to orders table
-- Run this in Supabase SQL Editor if you want orders to store internal_note natively in the database
-- ============================================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_note TEXT;

-- Ensure permissions for web client
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
