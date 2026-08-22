# 📋 SEALTHAI Shop Dashboard — Changelog & Update History

เอกสารบันทึกประวัติการพัฒนาและอัปเกรดระบบ SEALTHAI Shop Dashboard & AI Operations

---

## 🛠️ [v1.45] — 2026-08-22
### Login Recovery & JavaScript Startup Fix
* แก้การประกาศตัวแปร `currentActualStock` และ `currentActualCost` ซ้ำในหน้าประวัติความเคลื่อนไหวสต๊อก
* แก้ JavaScript หยุดทำงานตั้งแต่เปิดหน้า ซึ่งทำให้ปุ่ม Login ไม่ตอบสนอง
* อัปเดต Service Worker cache เป็น `sealthai-v1.45` เพื่อบังคับโหลดไฟล์ระบบล่าสุด

## 🚀 [v1.44] — 2026-08-21
### 🌟 ไฮไลต์การอัปเดต:
* **📜 Inventory Posting List & Stock Movement Ledger (ระบบดูประวัติความเคลื่อนไหวสต๊อกสินค้า):**
  * เพิ่มปุ่ม **`📜 เคลื่อนไหว`** และทำให้ช่องจำนวนสต๊อกในหน้า **"สินค้า (Products)"** และหน้า **"📊 วางแผนสต๊อก (Stock Planning)"** สามารถคลิกดูประวัติธุรกรรมสต๊อกได้ทันที
  * รวมทุกธุรกรรมทั้ง รับสินค้าเข้า (+In), ขายออกตามออเดอร์ (-Out), ปรับยอดสต๊อก (Adjustment), คืนสินค้า (Return In), และตัดจ่ายออก (Goods Issue)
  * คำนวณ **ยอดสต๊อกคงเหลือสะสม (Running Balance)** เรียงตามลำดับเวลาจริง
  * สรุป 4 KPI หลักด้านบน: สต๊อกปัจจุบัน (แยกคลังร้าน/Ecoseal), รวมรับเข้าทั้งหมด, รวมขายออกทั้งหมด, และมูลค่าสต๊อก
  * มีตัวกรองแยกตามประเภทธุรกรรม (รับเข้า, ขายออก, ปรับยอด, คืนของ) พร้อมช่องค้นหาตามเลขที่เอกสารอ้างอิงและหมายเหตุ

---

## 🚀 [v1.43] — 2026-08-21
* **📦 In-Modal Quick Product Creation:** สร้างสินค้าเข้าคลังด่วนจากหน้า Order / PO โดยไม่ต้องปิดหน้าต่างเดิมและข้อมูลไม่สูญหาย

---

## 🚀 [v1.42] — 2026-08-21
* **🔍 Unified Customer Search:** ค้นหารายชื่อลูกค้าแบบรวมศูนย์จาก CRM + Orders + Quotations พร้อมเติมข้อมูลอัตโนมัติ
* **🎨 1200×630 HD Facebook Thumbnail Generator:** AI ออกแบบภาพกราฟิกแบนเนอร์ HD อัตโนมัติสำหรับ Facebook
* **📸 Custom Image Upload:** แอดมินสามารถเลือกรูปภาพจากเครื่องคอมพิวเตอร์/มือถือใน AI Content Studio
* **🛍️ Public Product Blog Hub (`sealthai.com/blog`):** หน้ารวมบล็อกสินค้าพร้อมตัวกรองหมวดหมู่

---

## 🚀 [v1.41] — 2026-08-20
* **🤖 AI Content Studio & Marketing Engine:** ร่างคอนเทนต์อัตโนมัติ 09:00 / 15:00 น. ส่งเข้า Telegram
* **🚀 1-Click Facebook Share & Caption Copy:** ปุ่มลัดแชร์ขึ้นเพจ Facebook ใน 1 วินาที
* **🌐 Real-time FTP SEO Blog Publisher:** สร้างหน้าบทความเว็บสำหรับสินค้าแต่ละตัว
* **🌙 Daily Business Briefing:** สรุปยอดขายและการวิเคราะห์แชตลูกค้าที่ต้องการสินค้าขาดสต็อก (Unmet Demand)

---

## 🚀 [v1.40] — 2026-08-19
* **Multi-Order Batch PO Generator:** รวมหลายออเดอร์สร้างใบสั่งซื้อ (PO) ใบเดียว ยุบ SKU เดียวกันอัตโนมัติ
* **Agreed Pricing Priority Memory:** จดจำราคาประวัติเดิมที่เคยให้ลูกค้าแต่ละรายเป็นอันดับแรก
