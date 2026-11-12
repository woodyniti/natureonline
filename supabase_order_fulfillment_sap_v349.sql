-- ============================================================================
-- Sealthai Shop Dashboard - Order Fulfillment & SAP B1 Close Approval Schema (v3.49)
-- ============================================================================
-- เพิ่มคอลัมน์ fulfillment_data, closed_by, closed_at, close_reason ในตาราง orders
-- รองรับการจัดส่งบางส่วน (Partial Fulfillment), ยอดค้างส่ง (Backorders),
-- และการอนุมัติปิดเอกสารเมื่อลูกค้ายอมรับสินค้าบางส่วน (SAP B1 Close Document Workflow)
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_data JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS close_reason TEXT;

COMMENT ON COLUMN orders.fulfillment_data IS 'ข้อมูลการจัดส่งแบบบางส่วนและยอดค้างส่ง (shipped_qty, backorder_qty)';
COMMENT ON COLUMN orders.closed_by IS 'ชื่อผู้อนุมัติปิดเอกสารแบบ SAP Business One เมื่อลูกค้ายอมรับสินค้าบางส่วน';
COMMENT ON COLUMN orders.closed_at IS 'วันเวลาที่อนุมัติปิดเอกสาร';
COMMENT ON COLUMN orders.close_reason IS 'เหตุผลในการอนุมัติปิดเอกสาร เช่น ลูกค้ายอมรับสินค้าเท่าที่มี และขอยกเลิกยอดค้างส่ง';
