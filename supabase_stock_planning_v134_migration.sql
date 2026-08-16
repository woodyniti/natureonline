-- ================================================================
-- SEALTHAI v1.34: Product Master & Stock Planning Migration
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor
-- ================================================================

-- 1. เพิ่มฟิลด์สเปกซีลและพารามิเตอร์วางแผนสต๊อกในตาราง products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inner_diameter numeric(10,2),            -- รูใน ID (mm)
  ADD COLUMN IF NOT EXISTS outer_diameter numeric(10,2),            -- โตนอก OD (mm)
  ADD COLUMN IF NOT EXISTS width numeric(10,2),                     -- ความหนา Width/Height (mm)
  ADD COLUMN IF NOT EXISTS unit_dim text DEFAULT 'mm',              -- หน่วยวัด (mm / inch)
  ADD COLUMN IF NOT EXISTS material text,                           -- ชนิดวัสดุ เช่น NBR, FKM/Viton, PU, PTFE, Silicone, EPDM
  ADD COLUMN IF NOT EXISTS seal_type text,                          -- รูปแบบปากซีล เช่น TC, SC, TB, SB, VC, VB, TCV, TCN, O-Ring, Hydraulic
  ADD COLUMN IF NOT EXISTS max_pressure numeric(10,2),              -- แรงดันสูงสุด (bar)
  ADD COLUMN IF NOT EXISTS temp_min numeric(6,1),                   -- อุณหภูมิต่ำสุด (°C)
  ADD COLUMN IF NOT EXISTS temp_max numeric(6,1),                   -- อุณหภูมิสูงสุด (°C)
  ADD COLUMN IF NOT EXISTS max_speed numeric(8,2),                  -- ความเร็วรอบผิวสัมผัส (m/s)
  ADD COLUMN IF NOT EXISTS hs_code text,                            -- พิกัดศุลกากร HS Code
  ADD COLUMN IF NOT EXISTS drawing_no text,                         -- เลข Drawing / แบบแปลน
  ADD COLUMN IF NOT EXISTS machine_model text,                      -- รุ่นเครื่องจักร / ตำแหน่งการใช้งาน
  ADD COLUMN IF NOT EXISTS application_note text,                   -- บันทึกการใช้งาน / ชนิดของเหลว
  ADD COLUMN IF NOT EXISTS supplier_lead_time_days integer DEFAULT 30, -- ระยะเวลารอของจาก Supplier (วัน)
  ADD COLUMN IF NOT EXISTS moq numeric(12,2) DEFAULT 1,                -- สั่งซื้อขั้นต่ำ MOQ (ชิ้น)
  ADD COLUMN IF NOT EXISTS pack_size numeric(12,2) DEFAULT 1,          -- ขนาดบรรจุต่อกล่อง/แพ็ก (ชิ้น)
  ADD COLUMN IF NOT EXISTS safety_stock_days integer DEFAULT 15,       -- สต๊อกปลอดภัยคิดเป็นวัน
  ADD COLUMN IF NOT EXISTS min_safety_stock_qty numeric(12,2) DEFAULT 0, -- สต๊อกสำรองขั้นต่ำ (ชิ้น)
  ADD COLUMN IF NOT EXISTS manual_reorder_point numeric(12,2),         -- จุดสั่งซื้อใหม่ที่กำหนดเอง (ROP)
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- 2. สร้างตาราง product_cross_references สำหรับเทียบเบอร์ / OEM / ยี่ห้ออื่น
CREATE TABLE IF NOT EXISTS public.product_cross_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  brand text NOT NULL,                                              -- ยี่ห้อ เช่น NOK, SKF, Parker, Corteco, Koyo, National, OEM
  reference_part_no text NOT NULL,                                 -- รหัสเบอร์เทียบ
  note text,                                                       -- หมายเหตุความต่างสเปก
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. สร้าง Index เพื่อความรวดเร็วในการค้นหาและวิเคราะห์
CREATE INDEX IF NOT EXISTS products_dim_idx ON public.products(shop_id, inner_diameter, outer_diameter, width);
CREATE INDEX IF NOT EXISTS products_material_idx ON public.products(shop_id, material);
CREATE INDEX IF NOT EXISTS products_seal_type_idx ON public.products(shop_id, seal_type);
CREATE INDEX IF NOT EXISTS prod_xref_search_idx ON public.product_cross_references(shop_id, reference_part_no);
CREATE INDEX IF NOT EXISTS prod_xref_prod_idx ON public.product_cross_references(product_id);

-- 4. เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.product_cross_references ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies สำหรับ product_cross_references
DROP POLICY IF EXISTS "shop members cross references access" ON public.product_cross_references;
CREATE POLICY "shop members cross references access" ON public.product_cross_references
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = product_cross_references.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shop_members m
      WHERE m.shop_id = product_cross_references.shop_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.active, true)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = product_cross_references.shop_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shop_members m
      WHERE m.shop_id = product_cross_references.shop_id
        AND m.user_id = auth.uid()
        AND COALESCE(m.active, true)
        AND (m.role IN ('owner', 'admin') OR COALESCE(m.permissions->>'products', 'false') = 'true')
    )
  );
