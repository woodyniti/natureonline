-- SEALTHAI v3.28: ผู้ผลิต/Brand และหมายเหตุภายในของสินค้า
-- รันใน Supabase SQL Editor ก่อนบันทึกข้อมูลสองช่องใหม่นี้
-- ปลอดภัยสำหรับการรันซ้ำ และไม่เปลี่ยนข้อมูลสินค้าเดิม

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS internal_note text;

COMMENT ON COLUMN public.products.brand IS
  'ชื่อผู้ผลิตหรือแบรนด์ของสินค้าหลัก (ไม่ใช่แบรนด์ของเบอร์เทียบ)';

COMMENT ON COLUMN public.products.internal_note IS
  'หมายเหตุสำหรับทีมงานหลังร้าน ไม่ใช้ในเอกสารลูกค้าหรือเนื้อหาเว็บไซต์';
