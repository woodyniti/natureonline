-- Migration: Add supplier_description to products table
-- Version: v3.66
-- Description: เพิ่มคอลัมน์ supplier_description สำหรับเก็บ Item Description ของ Supplier (เช่น OIL SEAL NBR 55X90X8 TC)

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS supplier_description TEXT;

-- สร้าง Index เพื่อให้การค้นหาด้วย supplier_description รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_products_supplier_description 
ON products(supplier_description);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
