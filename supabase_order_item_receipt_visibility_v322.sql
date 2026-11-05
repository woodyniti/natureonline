-- v3.22: control whether each sales-order line appears on the cash receipt.
-- Existing lines and future inserts remain visible by default.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS show_on_receipt boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.order_items.show_on_receipt IS
  'Customer-facing cash receipt visibility only; hidden lines still affect stock, cost and order totals.';
