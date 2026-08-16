-- ================================================================
-- SEALTHAI v1.35: China Import & Landed Cost Tracking Migration
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor
-- ================================================================

-- 1. ตารางทะเบียนชิปเมนต์นำเข้า (import_shipments)
CREATE TABLE IF NOT EXISTS public.import_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  shipment_no text NOT NULL,                -- เลขชิปเมนต์ เช่น SH-2026-001
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  pi_no text,                               -- Proforma Invoice No.
  bl_no text,                               -- Bill of Lading / Air Waybill
  tracking_no text,                         -- Tracking ชิปปิ้ง
  currency text NOT NULL DEFAULT 'CNY',     -- CNY, USD, THB
  exchange_rate numeric(10,4) NOT NULL DEFAULT 5.1500, -- อัตราแลกเปลี่ยน
  incoterm text NOT NULL DEFAULT 'FOB',     -- EXW, FOB, CIF, DDP, CFR
  has_form_e boolean NOT NULL DEFAULT false, -- มีหนังสือรับรอง Form E / RCEP
  form_e_no text,
  transport_mode text DEFAULT 'sea',        -- sea (เรือ), air (เครื่องบิน), land (รถ)
  origin_port text,                         -- เช่น Ningbo, Shenzhen, Shanghai
  dest_port text,                           -- เช่น Bangkok Port, Laem Chabang
  etd date,                                 -- วันที่สินค้าออกจากจีน
  eta date,                                 -- วันที่สินค้าคาดว่าจะถึงไทย
  actual_arrival_date date,                 -- วันที่สินค้าเข้าคลังจริง
  status text NOT NULL DEFAULT 'draft',     -- draft, production, departed, customs, arrived, completed, cancelled
  allocation_method text NOT NULL DEFAULT 'value', -- value (ตามมูลค่า), weight (ตามน้ำหนัก), cbm (ตามปริมาตร), qty (ตามจำนวน)
  
  -- ค่าใช้จ่าย (บาท)
  total_product_foreign numeric(14,2) DEFAULT 0, -- รวมค่าสินค้าเงินต่างประเทศ
  total_product_thb numeric(14,2) DEFAULT 0,     -- รวมค่าสินค้าคิดเป็นบาท
  freight_china_thb numeric(12,2) DEFAULT 0,     -- ค่าขนส่งในจีน
  freight_intl_thb numeric(12,2) DEFAULT 0,      -- ค่าขนส่งระหว่างประเทศ
  insurance_thb numeric(12,2) DEFAULT 0,         -- ค่าประกันภัย
  customs_duty_thb numeric(12,2) DEFAULT 0,      -- อากรนำเข้า
  import_vat_thb numeric(12,2) DEFAULT 0,        -- VAT นำเข้า 7%
  customs_clearance_thb numeric(12,2) DEFAULT 0, -- ค่าบริการชิปปิ้ง/พิธีการ
  local_transport_thb numeric(12,2) DEFAULT 0,   -- ค่าขนส่งในไทย
  other_expenses_thb numeric(12,2) DEFAULT 0,    -- ค่าใช้จ่ายอื่นๆ
  total_landed_cost_thb numeric(14,2) DEFAULT 0, -- ต้นทุนรวมทั้งหมด
  
  -- การชำระเงิน
  deposit_amount_foreign numeric(12,2) DEFAULT 0,
  deposit_paid_date date,
  balance_amount_foreign numeric(12,2) DEFAULT 0,
  balance_paid_date date,
  payment_status text DEFAULT 'unpaid',     -- unpaid, deposit_paid, fully_paid
  
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ตารางรายการสินค้าในชิปเมนต์ (import_shipment_items)
CREATE TABLE IF NOT EXISTS public.import_shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.import_shipments(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text,
  part_no text,
  product_name text NOT NULL,
  hs_code text,
  qty numeric(12,2) NOT NULL DEFAULT 1,
  unit_price_foreign numeric(12,4) NOT NULL DEFAULT 0,
  total_price_foreign numeric(14,2) NOT NULL DEFAULT 0,
  duty_rate_pct numeric(5,2) DEFAULT 0,
  form_e_duty_rate_pct numeric(5,2) DEFAULT 0,
  weight_kg numeric(10,3) DEFAULT 0,
  cbm numeric(10,4) DEFAULT 0,
  
  -- ผลการกระจายต้นทุน
  allocated_overhead_thb numeric(14,2) DEFAULT 0,
  final_total_cost_thb numeric(14,2) DEFAULT 0,
  final_cost_per_unit_thb numeric(12,4) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS import_shipments_shop_idx ON public.import_shipments(shop_id, status);
CREATE INDEX IF NOT EXISTS import_shipments_date_idx ON public.import_shipments(shop_id, eta DESC);
CREATE INDEX IF NOT EXISTS import_shipment_items_shipment_idx ON public.import_shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS import_shipment_items_product_idx ON public.import_shipment_items(product_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.import_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_shipment_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "shop members import shipments access" ON public.import_shipments;
CREATE POLICY "shop members import shipments access" ON public.import_shipments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = import_shipments.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shop_members m
      WHERE m.shop_id = import_shipments.shop_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.active, true)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = import_shipments.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shop_members m
      WHERE m.shop_id = import_shipments.shop_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.active, true)
        AND (m.role IN ('owner', 'admin') OR COALESCE(m.permissions->>'purchase', 'false') = 'true')
    )
  );

DROP POLICY IF EXISTS "shop members import shipment items access" ON public.import_shipment_items;
CREATE POLICY "shop members import shipment items access" ON public.import_shipment_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.import_shipments s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.id = import_shipment_items.shipment_id AND sh.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.import_shipments s
      JOIN public.shop_members m ON m.shop_id = s.shop_id
      WHERE s.id = import_shipment_items.shipment_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.active, true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_shipments s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.id = import_shipment_items.shipment_id AND sh.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.import_shipments s
      JOIN public.shop_members m ON m.shop_id = s.shop_id
      WHERE s.id = import_shipment_items.shipment_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.active, true)
        AND (m.role IN ('owner', 'admin') OR COALESCE(m.permissions->>'purchase', 'false') = 'true')
    )
  );
