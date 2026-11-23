-- v4.14.1: optional per-order additional Contact Persons.
-- Run once in Supabase SQL Editor before saving an order with extra contacts.
-- Existing customer_contact/customer_phone/customer_email remain the primary contact.
-- No backfill or existing-order rewrite is required.
-- Rollback only after the application no longer reads this field:
--   ALTER TABLE public.orders DROP COLUMN order_contacts;
alter table public.orders add column if not exists order_contacts jsonb;
