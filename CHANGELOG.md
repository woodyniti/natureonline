# 📋 SEALTHAI Shop Dashboard — Changelog & Update History

เอกสารบันทึกประวัติการพัฒนาและอัปเกรดระบบ SEALTHAI Shop Dashboard & AI Operations

---

## 🚀 [v1.42] — 2026-08-21
### 🌟 ไฮไลต์การอัปเดต:
* **🔍 Unified Customer Search (ระบบค้นหาลูกค้าแบบรวมศูนย์):**
  * ค้นหารายชื่อลูกค้าในหน้าบันทึกออเดอร์ใหม่, แก้ไขออเดอร์, และใบเสนอราคาจาก 3 แหล่งพร้อมกัน (CRM Database + Orders History 1,000 ใบ + Quotations)
  * ค้นหาได้ทั้ง ชื่อ, เบอร์โทร, Username Shopee/Lazada, ที่อยู่, ผู้ติดต่อ, และเลขอ้างอิง
  * เติมข้อมูลลงฟอร์มอัตโนมัติใน 1 คลิก พร้อมระบุป้าย `[🏢 CRM B2B]` หรือ `[🛒 ออเดอร์เดิม (X ครั้ง)]`
* **🎨 1200×630 HD Facebook Thumbnail Generator:**
  * ระบบเรนเดอร์ภาพกราฟิกแบนเนอร์มาตรฐาน Facebook อัตโนมัติ (Pillow / PIL Engine)
  * ใส่ภาพสินค้าจริง, ป้ายคุณสมบัติวัสดุ (ทนร้อน 200°C / ไฮดรอลิก 400 bar), ป้ายสต๊อกพร้อมส่งในไทย และป้ายราคาเริ่มต้นสีทอง
  * อัปโหลดเข้าสู่ `/httpdocs/blog/images/` และฝังเป็น `og:image` อัตโนมัติ
* **📸 Custom Image Upload (แอดมินใส่ภาพเองได้):**
  * เพิ่มปุ่มเลือกภาพจากเครื่องคอมพิวเตอร์/มือถือ (`FileReader`) และช่องใส่ URL รูปภาพใน AI Content Studio
  * จอพรีวิวสดอัปเดตทันที และนำภาพนี้ไปสร้างบทความและแบนเนอร์ Facebook
* **🛍️ Public Product Blog Hub (`https://www.sealthai.com/blog/`):**
  * สร้างหน้ารวมบล็อกสินค้าพร้อมระบบค้นหาและแท็บตัวกรองหมวดหมู่วัสดุ (Viton, PU, NBR, Silicone)
  * เพิ่มเมนู `🛍️ Blog สินค้า` ในแถบนำทาง (Navbar) ของเว็บไซต์หลัก Sealthai.com
* **📦 Business Compliance Sanitization:**
  * นำข้อความเรื่องใบกำกับภาษีออกจากบทความเก่าและแบนเนอร์ทั้งหมด แทนที่ด้วยจุดเด่นเรื่อง "สต๊อกจริงพร้อมส่งในไทย"

---

## 🚀 [v1.41] — 2026-08-20
### 🌟 ไฮไลต์การอัปเดต:
* **🤖 AI Content Studio & Marketing Engine:**
  * ระบบสร้างร่างคอนเทนต์สินค้ารายวัน 4 สไตล์ (ช่างบอกต่อ, เจาะสเปก, ตารางเทียบขนาด, โปรโมชั่น)
  * ส่งร่างคอนเทนต์พร้อมรูปภาพเข้า Telegram แอดมินอัตโนมัติวันละ 2 รอบ (09:00 น. และ 15:00 น.)
* **🚀 1-Click Facebook Share & Caption Copy:**
  * ปุ่มลัดแชร์ขึ้น Facebook ใน 1 วินาที พร้อมบล็อกคัดลอกข้อความแคปชันและแฮชแท็ก
* **🌐 Real-time FTP SEO Blog Publisher:**
  * สร้างหน้าบทความเว็บสำหรับสินค้าแต่ละตัว และอัปโหลดผ่าน FTP ไปที่ `sealthai.com/blog/...` อัตโนมัติเมื่อกดอนุมัติ
* **🌙 Daily Business Briefing (03:00 น. & 09:00 น.):**
  * สรุปรายงานยอดขาย, กำไรสุทธิ, ออเดอร์รอจัดส่ง และวิเคราะห์แชตลูกค้าที่ต้องการสินค้าขาดสต็อก (Unmet Demand)

---

## 🚀 [v1.40] — 2026-08-19
* **Multi-Order Batch PO Generator:** รวมหลายออเดอร์สร้างใบสั่งซื้อ (PO) ใบเดียว ยุบ SKU เดียวกันอัตโนมัติ
* **Agreed Pricing Priority Memory:** จดจำราคาประวัติเดิมที่เคยให้ลูกค้าแต่ละรายเป็นอันดับแรก

---

## 🚀 [v1.30 – v1.39]
* v1.39: Customer Display Name & Order Customization
* v1.38: Executive AI & Predictive Intelligence Dashboard (Churn Alert & Cash Flow Forecasting)
* v1.37: CRM, Multi-Tier Pricing & B2B Sales Management
* v1.36: Multi-Marketplace Sync Hub (Shopee, Lazada, TikTok, LINE)
* v1.35: China Import & Landed Cost Tracking
* v1.34: Product Master & Stock Planning Intelligence (ROP / MOQ / ABC Analysis)
* v1.33: Storage RLS Policies Update
