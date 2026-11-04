-- SEALTHAI v3.10: bank transfer details printed on quotations.
-- Run once in Supabase SQL Editor. Printed quotations, including reprints,
-- use the shop's bank settings current at print time.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS quote_bank_name text,
  ADD COLUMN IF NOT EXISTS quote_bank_account_name text,
  ADD COLUMN IF NOT EXISTS quote_bank_account_number text;

COMMENT ON COLUMN public.shops.quote_bank_name IS 'Bank name shown on printed quotations';
COMMENT ON COLUMN public.shops.quote_bank_account_name IS 'Account holder shown on printed quotations';
COMMENT ON COLUMN public.shops.quote_bank_account_number IS 'Transfer account number shown on printed quotations';
