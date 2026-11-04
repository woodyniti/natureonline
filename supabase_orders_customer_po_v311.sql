-- SEALTHAI v3.11: customer purchase-order number for sales orders and cash-sale printouts.
-- Run once in Supabase SQL Editor before saving an order with a customer PO number.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_po_no text;

COMMENT ON COLUMN public.orders.customer_po_no IS 'Customer purchase order number printed after the order reference on cash-sale documents';
