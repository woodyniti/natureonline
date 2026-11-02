-- Run once in the Supabase SQL Editor before using the Shopee server sync button.
-- Stores order rows separately from sales orders and AI chat logs.
CREATE TABLE IF NOT EXISTS public.shopee_summary_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id text NOT NULL,
  sku text NOT NULL DEFAULT '',
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'array'),
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopee_summary_orders_shop_order_sku_key UNIQUE (shop_id, order_id, sku)
);

CREATE INDEX IF NOT EXISTS shopee_summary_orders_shop_idx
  ON public.shopee_summary_orders (shop_id, order_id);

ALTER TABLE public.shopee_summary_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.shopee_summary_orders TO authenticated;

DROP POLICY IF EXISTS shopee_summary_orders_read ON public.shopee_summary_orders;
CREATE POLICY shopee_summary_orders_read ON public.shopee_summary_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = shopee_summary_orders.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = shopee_summary_orders.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true))
  );

DROP POLICY IF EXISTS shopee_summary_orders_insert ON public.shopee_summary_orders;
CREATE POLICY shopee_summary_orders_insert ON public.shopee_summary_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = shopee_summary_orders.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = shopee_summary_orders.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true)
                 AND m.role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS shopee_summary_orders_update ON public.shopee_summary_orders;
CREATE POLICY shopee_summary_orders_update ON public.shopee_summary_orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = shopee_summary_orders.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = shopee_summary_orders.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true)
                 AND m.role IN ('owner', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = shopee_summary_orders.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = shopee_summary_orders.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true)
                 AND m.role IN ('owner', 'admin'))
  );
