-- SEALTHAI v4.12: one-time migration of legacy pending-order stock deductions.
-- Run once in Supabase SQL Editor AFTER deploying the v4.12 application.
-- Pending SO quantities remain reservations in orders/order_items, not physical stock_movements.
-- Old movement rows are preserved as JSON in the audit table before deletion.
-- The script is idempotent: a second run finds no matching old movements.

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_pending_stock_v412_audit (
  move_id text PRIMARY KEY,
  order_id text NOT NULL,
  product_id text NOT NULL,
  moved_qty numeric NOT NULL,
  old_stock_qty numeric,
  old_movement jsonb NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_pending_stock_v412_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_pending_stock_v412_audit FROM anon, authenticated;

CREATE TEMP TABLE v412_pending_moves ON COMMIT DROP AS
SELECT m.id, m.shop_id, m.product_id, m.qty, o.id AS order_id,
       to_jsonb(m) AS old_movement
FROM public.stock_movements AS m
JOIN public.orders AS o
  ON o.shop_id = m.shop_id
 AND m.note IN ('ขาย ' || o.order_no, 'ขาย ' || o.order_no || ' (แปลงจาก QT)')
WHERE COALESCE(o.shipping_status, 'pending') = 'pending'
  AND COALESCE(o.doc_status, '') <> 'cancelled'
  AND m.move_type = 'out';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM v412_pending_moves GROUP BY id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'พบเลขที่ movement ซ้ำจากการจับคู่ออเดอร์ กรุณาตรวจ order_no ก่อนย้ายยอด';
  END IF;
  IF EXISTS (
    SELECT 1 FROM v412_pending_moves AS pm
    LEFT JOIN public.products AS p ON p.id = pm.product_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'พบ movement ของสินค้าที่ไม่มีใน products จึงยังไม่ปรับยอด';
  END IF;
END $$;

CREATE TEMP TABLE v412_stock_before ON COMMIT DROP AS
SELECT p.id AS product_id, p.stock_qty AS old_stock_qty,
       SUM(ABS(pm.qty)) AS restore_qty
FROM public.products AS p
JOIN v412_pending_moves AS pm ON pm.product_id = p.id
GROUP BY p.id, p.stock_qty;

INSERT INTO public.order_pending_stock_v412_audit
  (move_id, order_id, product_id, moved_qty, old_stock_qty, old_movement)
SELECT pm.id::text, pm.order_id::text, pm.product_id::text, ABS(pm.qty),
       b.old_stock_qty, pm.old_movement
FROM v412_pending_moves AS pm
JOIN v412_stock_before AS b ON b.product_id = pm.product_id
ON CONFLICT (move_id) DO NOTHING;

DELETE FROM public.stock_movements AS m
USING v412_pending_moves AS pm
WHERE m.id = pm.id;

-- Use the captured pre-delete balance so a stock_movements DELETE trigger
-- cannot cause the quantity to be restored twice.
UPDATE public.products AS p
SET stock_qty = COALESCE(b.old_stock_qty, 0) + b.restore_qty
FROM v412_stock_before AS b
WHERE p.id = b.product_id;

COMMIT;

SELECT COUNT(*) AS archived_pending_movements,
       COALESCE(SUM(moved_qty), 0) AS archived_pending_units
FROM public.order_pending_stock_v412_audit;
