-- v3.16: private reason for each Purchase Order line.
-- Run once in Supabase SQL Editor before saving PO item notes.
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS internal_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.purchase_order_items.internal_note IS
  'Internal purchasing reason per PO line; never printed on supplier PO.';
