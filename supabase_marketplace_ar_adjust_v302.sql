-- Run once in the Supabase SQL Editor before adjusting Orders linked to AR Invoices.
-- This is an internal price-reconciliation log; it is NOT a tax credit/debit note.
CREATE TABLE IF NOT EXISTS public.ar_price_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  ar_id uuid NOT NULL REFERENCES public.ar_invoices(id),
  platform text NOT NULL CHECK (platform IN ('Shopee','Lazada')),
  source_ref text NOT NULL,
  old_total numeric NOT NULL,
  new_total numeric NOT NULL,
  paid_amount_at_adjustment numeric NOT NULL,
  delta numeric NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ar_price_adjustments_ar_idx ON public.ar_price_adjustments(ar_id,created_at DESC);
ALTER TABLE public.ar_price_adjustments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ar_price_adjustments TO authenticated;
DROP POLICY IF EXISTS ar_price_adjustments_read ON public.ar_price_adjustments;
CREATE POLICY ar_price_adjustments_read ON public.ar_price_adjustments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id=ar_price_adjustments.shop_id AND s.owner_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m WHERE m.shop_id=ar_price_adjustments.shop_id AND m.user_id=auth.uid() AND COALESCE(m.active,true))
  );

CREATE OR REPLACE FUNCTION public.apply_marketplace_ar_sale_adjustment(
  p_order_id uuid,
  p_ar_id uuid,
  p_expected_order_total numeric,
  p_expected_ar_total numeric,
  p_expected_paid numeric,
  p_target numeric,
  p_bill_discount numeric,
  p_item_id uuid,
  p_expected_item_price numeric,
  p_new_item_price numeric,
  p_platform text,
  p_source_ref text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_ar public.ar_invoices%ROWTYPE;
  v_paid numeric;
  v_subtotal numeric;
  v_shipping numeric;
  v_ref text;
  v_status text;
  v_log_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id=v_order.shop_id AND s.owner_id=auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m WHERE m.shop_id=v_order.shop_id AND m.user_id=auth.uid() AND COALESCE(m.active,true) AND m.role IN ('owner','admin'))
  ) THEN RAISE EXCEPTION 'Not allowed to adjust this shop'; END IF;
  SELECT * INTO v_ar FROM public.ar_invoices WHERE id=p_ar_id AND order_id=p_order_id AND shop_id=v_order.shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linked AR Invoice not found'; END IF;
  IF v_order.doc_status='cancelled' OR v_order.shipping_status='cancelled' OR v_ar.status='cancelled' THEN
    RAISE EXCEPTION 'Cancelled document cannot be adjusted';
  END IF;
  IF abs(v_order.total_amount-p_expected_order_total)>0.005 OR abs(v_ar.total_amount-p_expected_ar_total)>0.005 OR abs(COALESCE(v_ar.paid_amount,0)-p_expected_paid)>0.005 THEN
    RAISE EXCEPTION 'Order or AR changed since preview; refresh first';
  END IF;
  IF abs(v_order.total_amount-v_ar.total_amount)>0.01 THEN RAISE EXCEPTION 'Order and AR totals already differ; review first'; END IF;
  IF p_target IS NULL OR p_target<0 OR p_bill_discount IS NULL OR p_bill_discount<0 THEN RAISE EXCEPTION 'Invalid target or discount'; END IF;
  IF p_platform NOT IN ('Shopee','Lazada') OR lower(COALESCE(v_order.channel,'')) NOT LIKE '%'||lower(p_platform)||'%' THEN
    RAISE EXCEPTION 'Marketplace channel mismatch';
  END IF;
  v_ref := upper(trim(COALESCE(NULLIF(v_order.customer_social,''),to_jsonb(v_order)->>'platform_order_id','')));
  IF v_ref='' OR v_ref<>upper(trim(COALESCE(p_source_ref,''))) THEN RAISE EXCEPTION 'Marketplace reference mismatch'; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.ar_payments WHERE ar_id=p_ar_id AND shop_id=v_order.shop_id;
  IF abs(v_paid-COALESCE(v_ar.paid_amount,0))>0.01 THEN RAISE EXCEPTION 'AR payment history and paid amount differ; review first'; END IF;

  IF p_item_id IS NOT NULL THEN
    IF p_new_item_price IS NULL OR p_new_item_price<0 THEN RAISE EXCEPTION 'Invalid item price'; END IF;
    UPDATE public.order_items SET sell_price=p_new_item_price
      WHERE id=p_item_id AND order_id=p_order_id AND abs(sell_price-p_expected_item_price)<0.005;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order item price changed since preview'; END IF;
  END IF;
  SELECT COALESCE(SUM(GREATEST(0,COALESCE(qty,0)*COALESCE(sell_price,0)
    - CASE WHEN discount_type='percent' THEN COALESCE(qty,0)*COALESCE(sell_price,0)*COALESCE(discount,0)/100
           ELSE COALESCE(discount,0) END)),0)
    INTO v_subtotal FROM public.order_items WHERE order_id=p_order_id;
  v_shipping := COALESCE(NULLIF((to_jsonb(v_order)->>'shipping_fee')::numeric,0),
    NULLIF(substring(COALESCE(v_order.note,'') from '\[\[SHIPPING_FEE:([0-9.]+)\]\]')::numeric,0),0);
  IF abs(round((GREATEST(0,v_subtotal-p_bill_discount)+v_shipping)::numeric,2)-p_target)>0.01 THEN
    RAISE EXCEPTION 'Recalculated Order total does not match marketplace target';
  END IF;

  UPDATE public.orders SET total_amount=p_target,bill_discount=p_bill_discount,bill_discount_type='amount' WHERE id=p_order_id;
  v_status := CASE WHEN v_paid>=p_target THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END;
  UPDATE public.ar_invoices SET total_amount=p_target,status=v_status,
    note=concat_ws(E'\n',NULLIF(v_ar.note,''),
      '[Internal marketplace price adjustment '||to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM-DD HH24:MI')||
      ' '||p_platform||' '||v_ref||': '||v_ar.total_amount||' -> '||p_target||
      '; paid remains '||v_paid||']')
    WHERE id=p_ar_id;
  INSERT INTO public.ar_price_adjustments(shop_id,order_id,ar_id,platform,source_ref,old_total,new_total,paid_amount_at_adjustment,delta,created_by)
    VALUES(v_order.shop_id,p_order_id,p_ar_id,p_platform,v_ref,v_ar.total_amount,p_target,v_paid,p_target-v_ar.total_amount,auth.uid())
    RETURNING id INTO v_log_id;
  RETURN jsonb_build_object('adjustment_id',v_log_id,'order_total',p_target,'ar_total',p_target,'paid_amount',v_paid,
    'overpaid',GREATEST(0,v_paid-p_target),'status',v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_marketplace_ar_sale_adjustment(uuid,uuid,numeric,numeric,numeric,numeric,numeric,uuid,numeric,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_marketplace_ar_sale_adjustment(uuid,uuid,numeric,numeric,numeric,numeric,numeric,uuid,numeric,numeric,text,text) TO authenticated;

SELECT to_regprocedure('public.apply_marketplace_ar_sale_adjustment(uuid,uuid,numeric,numeric,numeric,numeric,numeric,uuid,numeric,numeric,text,text)') IS NOT NULL AS function_ready,
       to_regclass('public.ar_price_adjustments') IS NOT NULL AS history_table_ready;
