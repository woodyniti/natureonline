-- ==============================================================================
-- SEALTHAI SHOPFLOW: DATABASE SECURITY HARDENING & RLS ENFORCEMENT
-- Version: v4.15.0
-- Date: 2026-11-25
-- Description:
--   Resolves Supabase Security Advisor Critical Alerts:
--     1) rls_disabled_in_public (Row-Level Security disabled on public tables)
--     2) sensitive_columns_exposed (Sensitive tables/columns accessible by anon)
--
-- How to apply:
--   1. Open Supabase Dashboard: https://supabase.com/dashboard/project/omlqnxnlsxwiayryloki/sql
--   2. Click "New query", paste the entire contents of this file, and click "Run".
--   3. Refresh Supabase Dashboard > "Database" > "Security Advisor" to verify.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: REVOKE DANGEROUS PERMISSIONS FROM ANONYMOUS ROLE (anon)
-- ------------------------------------------------------------------------------
-- Ensure unauthenticated visitors (anon) CANNOT read, insert, update, or delete
-- any operational, financial, or personal customer/employee data.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- Revert default privileges so future tables will NOT grant access to anon
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon;

-- ------------------------------------------------------------------------------
-- STEP 2: ENSURE AUTHENTICATED STAFF & SERVICE ROLE HAVE FULL ACCESS
-- ------------------------------------------------------------------------------
-- Allow all logged-in staff members (role = 'authenticated') and backend services
-- to operate the dashboard normally without any disruption.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- STEP 3: ENABLE ROW LEVEL SECURITY (RLS) ON ALL PUBLIC TABLES & CREATE POLICIES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    pol RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        -- 1. Enable RLS on every table in public schema
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';

        -- 2. Drop previous/conflicting policies to prevent duplicate policy errors or stale anon access
        FOR pol IN (
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = r.tablename
        ) LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.' || quote_ident(r.tablename) || ';';
        END LOOP;

        -- 3. Create full CRUD policy for all authenticated users (logged-in staff)
        EXECUTE 'CREATE POLICY "authenticated_full_access" ON public.' || quote_ident(r.tablename) || '
                 FOR ALL TO authenticated
                 USING (true)
                 WITH CHECK (true);';

        -- 4. Create full access policy for service_role (background scripts, migrations, admin tasks)
        EXECUTE 'CREATE POLICY "service_role_full_access" ON public.' || quote_ident(r.tablename) || '
                 FOR ALL TO service_role
                 USING (true)
                 WITH CHECK (true);';
    END LOOP;
END
$$;

-- ------------------------------------------------------------------------------
-- STEP 3.1: ENSURE DETERMINISTIC LINE ORDERING COLUMNS
-- ------------------------------------------------------------------------------
-- Add sort_order and created_at columns to items tables so line ordering
-- (especially in Quotations, POs, and Orders) is deterministically preserved.
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- STEP 4: VERIFICATION QUERY
-- ------------------------------------------------------------------------------
-- Run this check to confirm all tables have rowsecurity = true (RLS enabled)
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
