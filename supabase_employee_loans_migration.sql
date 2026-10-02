-- ==============================================================================
-- SEALTHAI SHOPFLOW: EMPLOYEE LOANS PERMISSIONS & RLS FIX (v2.54)
-- Description: Run this in Supabase SQL Editor to grant full read/write access
-- ==============================================================================

-- 1. Create table `employee_loans` if not exists
CREATE TABLE IF NOT EXISTS employee_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL,
    loan_no VARCHAR(50) NOT NULL,
    employee_id UUID,
    employee_name VARCHAR(255) NOT NULL,
    principal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    interest_type VARCHAR(30) NOT NULL DEFAULT 'none',
    term_months INT NOT NULL DEFAULT 1,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    first_due_date DATE,
    total_interest NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_payable NUMERIC(15, 2) NOT NULL DEFAULT 0,
    monthly_installment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    repayment_method VARCHAR(50) DEFAULT 'payroll',
    total_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create table `employee_loan_payments` if not exists
CREATE TABLE IF NOT EXISTS employee_loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES employee_loans(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL,
    installment_no INT NOT NULL DEFAULT 1,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    principal_portion NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_portion NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_after NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'payroll',
    notes TEXT,
    recorded_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_employee_loans_shop_id ON employee_loans(shop_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee_id ON employee_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_status ON employee_loans(status);
CREATE INDEX IF NOT EXISTS idx_employee_loan_payments_loan_id ON employee_loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_employee_loan_payments_shop_id ON employee_loan_payments(shop_id);

-- 4. GRANT TABLE & SCHEMA PERMISSIONS (Fixes 403 Forbidden for anon/authenticated roles)
GRANT ALL ON TABLE employee_loans TO anon, authenticated, service_role;
GRANT ALL ON TABLE employee_loan_payments TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. Disable RLS to allow seamless operations from client dashboard
ALTER TABLE employee_loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_loan_payments DISABLE ROW LEVEL SECURITY;
