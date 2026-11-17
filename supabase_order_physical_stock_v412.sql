-- SEALTHAI v4.12.1: restore physical stock previously deducted by pending orders.
-- Run the whole script in Supabase SQL Editor after deploying v4.12 or later.
-- No temporary tables: each DO block is one atomic PostgreSQL statement.
-- Pending orders remain reservations; their old outbound movement is archived first.

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

DO $migration$
DECLARE
  product_row record;
  old_qty numeric;
  restored_qty numeric;
  deleted_count integer;
  total_deleted integer := 0;
  total_restored numeric := 0;
BEGIN
  -- A partially completed previous attempt cannot be repaired blindly.
  IF EXISTS (
    SELECT 1 FROM public.order_pending_stock_v412_audit a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stock_movements m WHERE m.id::text = a.move_id
    )
  ) THEN
    RAISE EXCEPTION 'พบ movement ที่เคยสำรองแล้วแต่ถูกลบก่อน migration นี้ กรุณาตรวจยอดสต๊อกก่อนรันซ้ำ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stock_movements m
    JOIN public.orders o ON o.shop_id = m.shop_id
      AND m.note IN ('ขาย ' || o.order_no, 'ขาย ' || o.order_no || ' (แปลงจาก QT)')
    WHERE COALESCE(o.shipping_status, 'pending') = 'pending'
      AND COALESCE(o.doc_status, '') <> 'cancelled' AND m.move_type = 'out'
    GROUP BY m.id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'พบ movement จับคู่ได้มากกว่าหนึ่งออเดอร์ กรุณาตรวจ order_no';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stock_movements m
    JOIN public.orders o ON o.shop_id = m.shop_id
      AND m.note IN ('ขาย ' || o.order_no, 'ขาย ' || o.order_no || ' (แปลงจาก QT)')
    LEFT JOIN public.products p ON p.id = m.product_id
    WHERE COALESCE(o.shipping_status, 'pending') = 'pending'
      AND COALESCE(o.doc_status, '') <> 'cancelled' AND m.move_type = 'out'
      AND p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'พบ movement ของสินค้าที่ไม่มีใน products จึงยังไม่ปรับยอด';
  END IF;

  FOR product_row IN
    SELECT DISTINCT p.id
    FROM public.products p
    JOIN public.stock_movements m ON m.product_id = p.id
    JOIN public.orders o ON o.shop_id = m.shop_id
      AND m.note IN ('ขาย ' || o.order_no, 'ขาย ' || o.order_no || ' (แปลงจาก QT)')
    WHERE COALESCE(o.shipping_status, 'pending') = 'pending'
      AND COALESCE(o.doc_status, '') <> 'cancelled' AND m.move_type = 'out'
    ORDER BY p.id
  LOOP
    SELECT p.stock_qty INTO old_qty
    FROM public.products p WHERE p.id = product_row.id FOR UPDATE;

    INSERT INTO public.order_pending_stock_v412_audit
      (move_id, order_id, product_id, moved_qty, old_stock_qty, old_movement)
    SELECT m.id::text, o.id::text, m.product_id::text, ABS(m.qty), old_qty,
           to_jsonb(m)
    FROM public.stock_movements m
    JOIN public.orders o ON o.shop_id = m.shop_id
      AND m.note IN ('ขาย ' || o.order_no, 'ขาย ' || o.order_no || ' (แปลงจาก QT)')
    WHERE m.product_id = product_row.id
      AND COALESCE(o.shipping_status, 'pending') = 'pending'
      AND COALESCE(o.doc_status, '') <> 'cancelled' AND m.move_type = 'out'
    ON CONFLICT (move_id) DO NOTHING;

    WITH deleted AS (
      DELETE FROM public.stock_movements m
      WHERE m.product_id = product_row.id AND m.move_type = 'out'
        AND EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.shop_id = m.shop_id
            AND m.note IN ('ขาย ' || o.order_no, 'ขาย ' || o.order_no || ' (แปลงจาก QT)')
            AND COALESCE(o.shipping_status, 'pending') = 'pending'
            AND COALESCE(o.doc_status, '') <> 'cancelled'
        )
        AND EXISTS (
          SELECT 1 FROM public.order_pending_stock_v412_audit a
          WHERE a.move_id = m.id::text
        )
      RETURNING m.qty
    )
    SELECT COUNT(*), COALESCE(SUM(ABS(qty)), 0)
      INTO deleted_count, restored_qty FROM deleted;

    IF deleted_count > 0 THEN
      -- Snapshot the pre-delete balance, so any DELETE trigger cannot restore twice.
      UPDATE public.products p
      SET stock_qty = COALESCE(old_qty, 0) + restored_qty
      WHERE p.id = product_row.id;
      total_deleted := total_deleted + deleted_count;
      total_restored := total_restored + restored_qty;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migrated % pending movements; restored % physical units',
    total_deleted, total_restored;
END
$migration$;

SELECT COUNT(*) AS archived_pending_movements,
       COALESCE(SUM(moved_qty), 0) AS archived_pending_units
FROM public.order_pending_stock_v412_audit;
