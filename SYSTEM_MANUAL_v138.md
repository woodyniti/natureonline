# 📘 คู่มือและรายงานสรุปการพัฒนาระบบ SEALTHAI (v1.38)
> **ระบบบริหารจัดการร้านค้า, ลูกหนี้การค้า (AR), ใบลดหนี้ (CN), และ AI วิเคราะห์ธุรกิจอัจฉริยะ**  
> *วันที่อัปเดต: 16 สิงหาคม 2026* | *Branch: main* | *Live App: https://woodyniti.github.io/natureonline/*

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมการพัฒนา (System Overview)](#1-ภาพรวมการพัฒนา-system-overview)
2. [ระบบลูกหนี้การค้าและการรับเงิน (AR Invoices & Collections)](#2-ระบบลูกหนี้การค้าและการรับเงิน-ar-invoices--collections)
3. [ระบบออกใบลดหนี้ (Credit Note - CN)](#3-ระบบออกใบลดหนี้-credit-note---cn)
4. [ระบบ AI วิเคราะห์ธุรกิจ (Executive AI Advisor)](#4-ระบบ-ai-วิเคราะห์ธุรกิจ-executive-ai-advisor)
5. [Dashboard ภาพรวม & การปรับปรุงการคำนวณ](#5-dashboard-ภาพรวม--การปรับปรุงการคำนวณ)
6. [มาตรการความปลอดภัยและป้องกันข้อผิดพลาด (Guardrails & Validations)](#6-มาตรการความปลอดภัยและป้องกันข้อผิดพลาด-guardrails--validations)
7. [โครงสร้างฐานข้อมูล (Database Schema & Migrations)](#7-โครงสร้างฐานข้อมูล-database-schema--migrations)

---

## 1. ภาพรวมการพัฒนา (System Overview)

ในเวอร์ชันนี้ ระบบได้รับการยกระดับครอบคลุม 3 แกนหลักของธุรกิจ B2B และ Multi-Channel:
1. **การควบคุมการเงินและลูกหนี้การค้า (Financial & Cash Flow Control)**: บริหารจัดการ AR Invoice, การรับชำระเงิน, การแก้ไขวันที่รับเงินย้อนหลัง, และการออก CN
2. **การทำงานแบบเป็นชุด (Batch Operations)**: แปลง Sales Order เป็น AR พร้อมกัน, รับชำระเงินพร้อมกันหลายบิล, และเปลี่ยนวันที่รับเงินแบบกลุ่ม
3. **ระบบวิเคราะห์และพยากรณ์อัจฉริยะ (Predictive AI Intelligence)**: ดัชนีสุขภาพธุรกิจ, เตือนลูกค้าประจำที่เริ่มเงียบ (Churn Alert), และพยากรณ์กระแสเงินสด 30/60/90 วันล่วงหน้า

---

## 2. ระบบลูกหนี้การค้าและการรับเงิน (AR Invoices & Collections)

### 2.1 การป้องกันการเปิด AR Invoice ซ้ำจาก Sales Order เดียวกัน
* **ตารางออเดอร์ (`orders`):**
  * SO ใดที่มี AR Invoice แล้ว Checkbox จะถูกล็อกและแสดงไอคอน `📄`
  * แสดงป้ายสีน้ำเงิน `📄 [เลขที่ AR]` ใต้เลข SO ซึ่งสามารถคลิกเพื่อเปิดดู Invoice นั้นได้ทันที
* **หน้าต่างดูรายละเอียดออเดอร์ (`viewOrder`):**
  * เปลี่ยนปุ่มจาก `📄 Copy to Invoice` เป็น `📄 ดู AR Invoice ([เลขที่ AR])` ป้องกันการกดสร้างซ้ำ
* **ระบบ Guard ในฐานข้อมูล:**
  * ฟังก์ชัน `convertSOtoAR` และ `batchConvertSOtoAR` จะตรวจสอบฐานข้อมูล Real-time หากพบ AR ที่ยังไม่ถูกยกเลิก จะปฏิเสธการสร้างทันที

### 2.2 การสร้าง AR Invoice เป็นชุด (Batch Convert SO to AR)
* ติ๊กเลือก Sales Order หลายรายการในหน้าตารางออเดอร์
* กดปุ่ม `📄 สร้าง AR เป็นชุด ([จำนวน])` ที่ Topbar
* ระบบจะข้ามรายการที่มี AR แล้วโดยอัตโนมัติ และสร้าง Invoice ให้เฉพาะรายการที่ยังไม่มี

### 2.3 การรับชำระเงินเดี่ยวและการรับชำระเงินเป็นชุด (Batch AR Payment)
* **ป้องกันการรับชำระซ้ำ 100%:** บิลที่สถานะเป็น `paid` หรือมียอดค้าง $\le 0$ จะถูกล็อก Checkbox และไม่สามารถบันทึกรับเงินซ้ำได้
* **รับชำระเงินเป็นชุด:** ติ๊กเลือกบิลที่ค้างชำระ $\rightarrow$ กด `💵 รับชำระเงินเป็นชุด ([จำนวน])` $\rightarrow$ ระบุวันที่รับ, วิธีชำระ, เลขที่อ้างอิง/สลิป $\rightarrow$ ระบบจะบันทึกการรับเงินและอัปเดตสถานะบิลทั้งหมดพร้อมกัน

### 2.4 การแก้ไขวันที่รับเงิน (Edit Payment Date)
* **แก้ไขรายบิล:** ในหน้าต่างรายละเอียด AR Invoice $\rightarrow$ ส่วน *"ประวัติรับเงิน"* $\rightarrow$ กดปุ่ม `✏️ แก้ไขวันที่` ในแต่ละงวด
* **แก้ไขเป็นชุด (Batch Edit Payment Date):**
  * ติ๊กเลือกหลายบิลที่รับเงินแล้ว $\rightarrow$ กดปุ่มสีส้มทอง `✏️ แก้วันที่รับเงินเป็นชุด ([จำนวน])`
  * ระบุวันที่รับเงินใหม่ (New Payment Date) $\rightarrow$ ระบบจะอัปเดต `pay_date` ของทุกบิลให้ตรงรอบบัญชีทันที

### 2.5 การแสดงผลข้อมูลอ้างอิงและตัวกรอง
* **คอลัมน์ในตาราง AR Invoice:**
  * แสดงเลขที่ AR
  * แสดง **🛒 SO: [เลขที่ SO]**
  * แสดง **📄 [เลขอ้างอิงเอกสาร Shopee / Platform Ref]**
  * แสดง **📅 เปิด: [วันที่เปิดบิล]** และ **💵 รับ: [วันที่รับเงินจริง]**
* **ตัวกรองสถานะใหม่:**
  * `⏳ ค้างจ่าย/ค้างรับ (มียอดค้างทั้งหมด)`
  * `⚠️ เกินกำหนดชำระ (Overdue)`
  * `🔴 ค้างชำระเต็มจำนวน (Unpaid)`
  * `🟡 ชำระแล้วบางส่วน (Partial)`
  * `🟢 ชำระครบแล้ว (Paid)`
  * `❌ ยกเลิก / CN`
  * `🔍 ช่องค้นหาด่วน`: ค้นหาตามชื่อลูกค้า, เลข AR, SO, และเลขอ้างอิง Shopee

---

## 3. ระบบออกใบลดหนี้ (Credit Note - CN)

* **การเปิดใช้งาน:** ในหน้าต่างรายละเอียด AR Invoice มีปุ่ม `🧾 ออกใบลดหนี้ (CN) / ยกเลิก`
* **ข้อมูลที่บันทึก:**
  * **เลขที่ใบลดหนี้ (CN No.):** รันให้อัตโนมัติ (เช่น `CN-YYYYMMDD-XXXX`)
  * **วันที่ออกใบลดหนี้:** เลือกวันที่ต้องการ
  * **สาเหตุการออกใบลดหนี้ (CN Reason):**
    * 🔄 รับคืนสินค้า (สินค้าไม่ตรงสเปก / ส่งผิด)
    * ⚠️ สินค้าชำรุด / เสียหาย
    * 💰 ปรับลดราคาพิเศษ / ส่วนลดการค้า
    * ❌ ยกเลิกบิลเนื่องจากออกผิด
    * อื่นๆ
  * **หมายเหตุเพิ่มเติม**
* **ผลกระทบทางบัญชี:**
  * เปลี่ยนสถานะ Invoice เป็น `cancelled` (ยกเลิก / CN)
  * บันทึกรายการกลับยอดรับเงิน (`-amount`) ในตาราง `ar_payments`
  * นำยอดหนี้ออกจากลูกหนี้คงค้างใน Dashboard ทันที

---

## 4. ระบบ AI วิเคราะห์ธุรกิจ (Executive AI Advisor)

เข้าใช้งานได้ที่เมนูด้านซ้าย: **`🤖 AI วิเคราะห์ธุรกิจ`**

```
┌─────────────────────────────────────────────────────────────┐
│                   🤖 Executive AI Advisor                   │
├───────────────┬───────────────┬───────────────┬─────────────┤
│ 🩺 Health     │ 🚨 Lost Churn │ 💵 Cash Flow  │ 🛒 Cross    │
│    Check      │    Alert      │    Forecast   │    Sell     │
└───────────────┴───────────────┴───────────────┴─────────────┘
```

### 4.1 🩺 Executive AI Health Check
* ประเมินดัชนีสุขภาพธุรกิจ (Business Health Score)
* แจกแจง 3 ข้อเสนอแนะเชิงปฏิบัติการประจำสัปดาห์ (Actionable Insights) พร้อมปุ่มกดดำเนินการทันที

### 4.2 🚨 Lost Customer Churn Alert (เตือนลูกค้าประจำที่เริ่มเงียบ)
* AI วิเคราะห์รอบการสั่งซื้อปกติของลูกค้าแต่ละราย (เช่น ทุก 15-30 วัน)
* ตรวจจับลูกค้าที่ขาดการสั่งซื้อเกินรอบปกติ:
  * 🟡 **เริ่มเงียบ (30 - 60 วัน):** ความเสี่ยงปานกลาง
  * 🔴 **เสี่ยงสูง (60 - 90 วัน):** ความเสี่ยงสูง
  * 🔵 **ลูกค้าหลุด (> 90 วัน):** ขาดการติดต่อ
* แสดงยอดซื้อเฉลี่ย/เดือน และสินค้าที่ลูกค้าเคยสั่งซื้อประจำ
* ปุ่ม **`📞 ทักหา`**: บันทึกผลการติดตาม (สนใจส่งใบเสนอราคา / รอเช็คสต๊อก / เครื่องจักรหยุด / เปลี่ยนเจ้า)

### 4.3 💵 Cash Flow Forecasting (พยากรณ์กระแสเงินสด 30 / 60 / 90 วัน)
* **ฝั่งรายรับ (Projected Inflows):**
  * 🛒 **ยอดขายสด/ออนไลน์:** คำนวณจาก Daily Sales Run Rate ของร้าน $\times$ จำนวนวัน
  * 📄 **ลูกหนี้การค้าครบกำหนด:** คำนวณจากยอดค้างชำระของ `ar_invoices` ตาม Due Date
  * 💵 **เชื่อมโยงประวัติรับเงินจริง:** ดึงยอดรับจริงจาก `ar_payments` ใน 30 วันที่ผ่านมามาแสดงเปรียบเทียบ
* **ฝั่งรายจ่าย (Projected Outflows):**
  * 🏢 **เจ้าหนี้การค้า (AP Due):** ยอดค้างชำระบิลซื้อ
  * 🚢 **ค่างวดนำเข้าสินค้าจีน:** ยอดค้างจ่ายใน Shipment ที่ยังไม่ Complete
  * 💸 **ค่าใช้จ่ายประจำ/ดำเนินงาน:** เฉลี่ยจากตาราง `expenses`
* **ตารางแจกแจงและกราฟ:** แสดงเงินสดสุทธิ (Net Cash Flow) แยกราย 30, 60, และ 90 วัน

### 4.4 🛒 Market Basket Cross-Sell Pairing
* AI ประมวลผลประวัติออเดอร์ในอดีตเพื่อหาคู่สินค้าที่มักถูกสั่งซื้อพร้อมกันบ่อยที่สุด
* แสดงระดับความน่าจะเป็น (Confidence %) เพื่อให้เซลส์เสนอขายพ่วงตอนเปิดบิล

---

## 5. Dashboard ภาพรวม & การปรับปรุงการคำนวณ

* **การ์ด 💵 รับเงินแล้ว (ช่วงนี้):**
  * คำนวณตาม **`pay_date` ในตาราง `ar_payments`** ที่เกิดขึ้นจริงภายในช่วงวันที่เลือก (Period Filter)
  * แสดงจำนวนรายการรับเงินที่เกิดขึ้นจริง
* **การ์ด ⏳ ยอดค้างรับ (Outstanding AR):**
  * สรุปยอดหนี้คงเหลือที่ยังไม่ได้รับชำระทั้งหมด (`total_amount - paid_amount`)
  * คลิกที่การ์ดเพื่อเปิดดูรายการ AR Invoice ได้ทันที

---

## 6. มาตรการความปลอดภัยและป้องกันข้อผิดพลาด (Guardrails & Validations)

1. **Syntax & Script Safety:** ตรวจสอบความถูกต้องของ JavaScript ทุกบรรทัดผ่าน automated validator script เพื่อป้องกัน ReferenceError และ SyntaxError
2. **Safe Column Queries:** ปรับคำสั่ง Supabase Query ให้ดึงเฉพาะคอลัมน์ที่มีอยู่จริง เพื่อป้องกันข้อผิดพลาดจาก PostgREST 42703
3. **Database RLS Policies:** กำหนด Row-Level Security ให้กับตาราง `ar_invoices` และ `ar_payments` ให้ผู้ใช้งานที่มีสิทธิ์เข้าถึงข้อมูลได้อย่างปลอดภัย

---

## 7. โครงสร้างฐานข้อมูล (Database Schema & Migrations)

ไฟล์ Migration SQL ที่ถูกสร้างและพร้อมใช้งาน:
* `supabase_all_in_one_v136_v137_v138_migration.sql`: สคริปต์สร้างตาราง `customers`, `customer_contacts`, `customer_tier_pricing`, `ar_invoices`, `ar_payments`
* `supabase_fix_ar_invoices_rls.sql`: สคริปต์แก้ไข RLS Policies ของระบบ AR

```sql
-- ตัวอย่างโครงสร้างหลักของ ar_invoices และ ar_payments
CREATE TABLE IF NOT EXISTS public.ar_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id),
  order_id UUID REFERENCES public.orders(id),
  customer_id UUID REFERENCES public.customers(id),
  ar_no TEXT NOT NULL,
  ar_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  customer_name TEXT,
  total_amount NUMERIC(15,2) DEFAULT 0,
  paid_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'unpaid', -- unpaid, partial, paid, cancelled
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id),
  ar_id UUID REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
  pay_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL,
  method TEXT DEFAULT 'โอนเงิน',
  ref TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

*เอกสารฉบับนี้จัดทำขึ้นเพื่อเป็นคู่มือมาตรฐานสำหรับการใช้งานและบำรุงรักษาระบบ SEALTHAI ต่อไป*
