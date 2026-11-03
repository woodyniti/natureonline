-- Run once in Supabase SQL Editor before using Lazada server sync.
-- One row per Lazada order item; the payload contains only product and settlement
-- fields, never customer names, addresses, phones, emails or tax identifiers.
CREATE TABLE IF NOT EXISTS public.lazada_summary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_item_id text NOT NULL,
  order_id text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lazada_summary_items_shop_item_key UNIQUE (shop_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS lazada_summary_items_shop_order_idx
  ON public.lazada_summary_items (shop_id, order_id);

ALTER TABLE public.lazada_summary_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.lazada_summary_items TO authenticated;

DROP POLICY IF EXISTS lazada_summary_items_read ON public.lazada_summary_items;
CREATE POLICY lazada_summary_items_read ON public.lazada_summary_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = lazada_summary_items.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = lazada_summary_items.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true))
  );

DROP POLICY IF EXISTS lazada_summary_items_insert ON public.lazada_summary_items;
CREATE POLICY lazada_summary_items_insert ON public.lazada_summary_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = lazada_summary_items.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = lazada_summary_items.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true)
                 AND m.role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS lazada_summary_items_update ON public.lazada_summary_items;
CREATE POLICY lazada_summary_items_update ON public.lazada_summary_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = lazada_summary_items.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = lazada_summary_items.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true)
                 AND m.role IN ('owner', 'admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s
            WHERE s.id = lazada_summary_items.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.shop_members m
               WHERE m.shop_id = lazada_summary_items.shop_id
                 AND m.user_id = auth.uid() AND COALESCE(m.active, true)
                 AND m.role IN ('owner', 'admin'))
  );
