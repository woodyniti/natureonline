-- SEALTHAI v4.12.3: one-time repair for SO-20261117-0003 only.
-- The order was marked shipped, but the earlier client error left stock at 19
-- with no sale movement. The user confirmed 10 units were physically shipped
-- and 9 remain. Run this entire file in Supabase SQL Editor once.
-- The DO statement is atomic. Any failed guard rolls back both the movement
-- insert and the product balance update. Do not edit the target order/SKU.

DO $repair$
DECLARE
  v_order record;
  v_item record;
  v_stock_before numeric;
  v_stock_after_insert numeric;
  v_existing integer;
BEGIN
  SELECT o.id, o.shop_id, o.order_no, o.order_date, o.shipping_status
    INTO v_order
  FROM public.orders o
  WHERE o.shop_id = '90c6e123-c6ed-4499-88d9-28edb3768d72'
    AND o.order_no = 'SO-20261117-0003'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบออเดอร์เป้าหมายในร้าน SEALTHAI';
  END IF;
  IF v_order.shipping_status IS DISTINCT FROM 'shipped'
     AND v_order.shipping_status IS DISTINCT FROM 'delivered' THEN
    RAISE EXCEPTION 'ออเดอร์ไม่ได้อยู่สถานะจัดส่งแล้ว (%); หยุดซ่อม', v_order.shipping_status;
  END IF;
  IF (SELECT COUNT(*) FROM public.order_items WHERE order_id = v_order.id) <> 1 THEN
    RAISE EXCEPTION 'จำนวนบรรทัดออเดอร์เปลี่ยนไป; หยุดซ่อม';
  END IF;

  SELECT oi.product_id, oi.qty, oi.cost_per_unit INTO v_item
  FROM public.order_items oi WHERE oi.order_id = v_order.id;
  IF v_item.product_id IS NULL OR v_item.qty IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'สินค้า/จำนวนในออเดอร์เปลี่ยนไป; หยุดซ่อม';
  END IF;

  SELECT p.stock_qty INTO v_stock_before
  FROM public.products p
  WHERE p.id = v_item.product_id
    AND p.shop_id = v_order.shop_id
    AND p.sku = 'OIL SEAL NBR 12X27X5 SC'
  FOR UPDATE;
  IF NOT FOUND OR v_stock_before IS DISTINCT FROM 19 THEN
    RAISE EXCEPTION 'สินค้า/ยอดคงเหลือไม่ใช่ 19 ชิ้นแล้ว; หยุดซ่อม';
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM public.stock_movements m
  WHERE m.shop_id = v_order.shop_id
    AND m.product_id = v_item.product_id
    AND m.move_type = 'out'
    AND COALESCE(m.note, '') LIKE '%' || v_order.order_no || '%';
  IF v_existing <> 0 THEN
    RAISE EXCEPTION 'พบ movement ตัดสต๊อกออเดอร์นี้แล้ว; หยุดเพื่อป้องกันการตัดซ้ำ';
  END IF;

  INSERT INTO public.stock_movements
    (shop_id, product_id, move_type, qty, cost_per_unit, note, move_date)
  VALUES
    (v_order.shop_id, v_item.product_id, 'out', 10,
     COALESCE(v_item.cost_per_unit, 0), 'ขาย ' || v_order.order_no,
     v_order.order_date);

  -- Some installations adjust stock from an INSERT trigger; others do not.
  -- Both paths finish at the absolute, physically confirmed balance of 9.
  SELECT p.stock_qty INTO v_stock_after_insert
  FROM public.products p WHERE p.id = v_item.product_id;
  IF v_stock_after_insert IS NULL OR v_stock_after_insert NOT IN (19, 9) THEN
    RAISE EXCEPTION 'ยอดสต๊อกหลังเพิ่ม movement ผิดคาด (%); ย้อนการซ่อมทั้งหมด', v_stock_after_insert;
  END IF;
  UPDATE public.products p SET stock_qty = 9 WHERE p.id = v_item.product_id;
END
$repair$;

SELECT o.order_no, o.shipping_status, p.sku, p.stock_qty,
       COUNT(m.id) AS sale_movements,
       COALESCE(SUM(ABS(m.qty)), 0) AS sold_units_posted
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
JOIN public.products p ON p.id = oi.product_id
LEFT JOIN public.stock_movements m ON m.shop_id = o.shop_id
  AND m.product_id = p.id AND m.move_type = 'out'
  AND m.note = 'ขาย ' || o.order_no
WHERE o.shop_id = '90c6e123-c6ed-4499-88d9-28edb3768d72'
  AND o.order_no = 'SO-20261117-0003'
GROUP BY o.order_no, o.shipping_status, p.sku, p.stock_qty;
