-- ==============================================================================
-- SEALTHAI SHOPFLOW: MASTER PERMISSIONS UNLOCK & RLS FIX
-- Version: v2.57
-- Description: Unlocks full read/write permissions for all tables and sequences
-- ==============================================================================

-- 1. Ensure table `goods_returns` & `goods_return_items` exist
CREATE TABLE IF NOT EXISTS goods_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    gr_no VARCHAR(50) NOT NULL,
    gr_date DATE NOT NULL DEFAULT CURRENT_DATE,
    return_type VARCHAR(30) NOT NULL DEFAULT 'sale', -- 'sale', 'purchase'
    reason TEXT,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'done',
    customer_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_id UUID NOT NULL REFERENCES goods_returns(id) ON DELETE CASCADE,
    product_id UUID,
    product_name VARCHAR(255),
    qty NUMERIC(15, 2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. GRANT FULL PERMISSIONS ON ALL TABLES & SEQUENCES TO anon, authenticated, service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for any future tables created
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 3. DISABLE RLS ON ALL OPERATIONAL TABLES (Matches standard shopflow setup)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';
    END LOOP;
END
$$;
