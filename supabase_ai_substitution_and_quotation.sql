-- ==========================================================
-- SEALTHAI AI SUBSTITUTION & QUOTATION SYSTEM MIGRATION
-- Version: v1.38+ (AI Chat-to-Quote & Substitution Engine)
-- ==========================================================

-- 1. Table: approved_substitutes (บันทึกคู่สินค้าทดแทนที่ผ่านการอนุมัติ)
CREATE TABLE IF NOT EXISTS public.approved_substitutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  seal_type TEXT NOT NULL, -- 'O-Ring', 'Oil Seal', 'Hydraulic Seal'
  requested_spec TEXT NOT NULL, -- เช่น '90x5.50 NBR' หรือ 'SC 25x40x7'
  substitute_sku TEXT NOT NULL, -- SKU ของสินค้าที่ใช้แทน
  substitute_name TEXT,
  substitute_dimensions TEXT, -- เช่น '89.60x5.70 N70 (P-090)'
  application_condition TEXT DEFAULT 'Static Seal Only', -- 'Static Seal Only', 'General', 'High Pressure'
  notes TEXT,
  approved_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.approved_substitutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approved_substitutes_all" ON public.approved_substitutes;
CREATE POLICY "approved_substitutes_all" ON public.approved_substitutes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 2. Table: ai_chat_logs (บันทึกประวัติการสอบถามและตอบกลับของบอท LINE OA / Telegram)
CREATE TABLE IF NOT EXISTS public.ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- 'line', 'telegram', 'web_dashboard'
  sender_id TEXT,
  sender_name TEXT,
  message_text TEXT NOT NULL,
  ai_response TEXT,
  detected_items JSONB,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chat_logs_all" ON public.ai_chat_logs;
CREATE POLICY "ai_chat_logs_all" ON public.ai_chat_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
