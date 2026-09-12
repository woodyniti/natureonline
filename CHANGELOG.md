# 📋 SEALTHAI Shop Dashboard — Changelog & Update History

เอกสารบันทึกประวัติการพัฒนาและอัปเกรดระบบ SEALTHAI Shop Dashboard & AI Operations

---

## 🚀 [v1.93] — 2026-09-12
### Fix Database Column Reference for Order Items & Enhanced Product Search
* **🐛 PostgREST Query Fix:** ปรับแก้ไขคำสั่งเรียกข้อมูลตาราง `order_items` ให้ตรงกับโครงสร้างฟิลด์ฐานข้อมูล (ตัดฟิลด์ sku ที่ไม่อยู่ใน order_items ออก แล้วเชื่อมโยง SKU / Part No จาก Master Products แทน)
* **🔍 Seamless Search:** ค้นหาออเดอร์ตามชื่อสินค้า, รหัส SKU, Part No, Supplier Code, Barcode ได้อย่างรวดเร็วและไม่มีข้อผิดพลาด
* **🧹 Cache Refresh (v1.93):** อัปเดต Service Worker Cache เป็น `sealthai-v1.93` เพื่อโหลดเวอร์ชันที่แก้ไขแล้วทันที

---

## 🚀 [v1.92] — 2026-09-12
### Search Orders by Product Name, SKU, and Part No
* **🔍 Smart Order Product Search:** ช่องค้นหาในหน้าบันทึกออเดอร์รองรับการค้นหาตาม **ชื่อสินค้า, รหัส SKU, Part No, Supplier Code และ Barcode** เพื่อให้ค้นหาได้สะดวกรวดเร็วว่าสินค้ารายการใดเคยเปิดออเดอร์ใบไหนไปบ้าง
* **🏷️ Order Items SKU & Part No Badges:** แสดงป้าย `[SKU]` และ `[#Part No]` ประกอบกับชื่อสินค้าในตารางรายการออเดอร์ (ทั้ง Desktop และ Mobile)
* **🧹 Cache Refresh (v1.92):** อัปเดต Service Worker Cache เป็น `sealthai-v1.92` เพื่อโหลดเวอร์ชันใหม่ทันที

---

## 🚀 [v1.91] — 2026-09-11
### Employee Commission Standard 15% of Profit After GP Platform
* **👤 Employee Commission 15%:** ปรับการแสดงผลและสูตรคำนวณค่าคอมมิชชั่นพนักงาน (นิติ บุญสายันต์) ใน Dashboard ภาพรวม และหน้ารายการออเดอร์ เป็น **15% ของกำไรหลังหัก GP Platform แล้ว** ให้ตรงตามมาตรฐานร่วมกับ CFO (นันทนา 15%)
* **🧹 Instant Cache Refresh:** อัปเดต Service Worker Cache เป็น `sealthai-v1.91` เพื่อบังคับล้างแคชและอัปเดตหน้าจอทันที

---

## 🚀 [v1.90] — 2026-09-08
### AI Content Studio with Real Order Items & Auto-Trigger on Order Shipped
* **🎨 Real Orders in AI Content Studio:** ดึงข้อมูลสินค้าที่ขายได้จริงจากคำสั่งซื้อ (Shopee, Lazada, หน้าร้าน) มาประมวลผลเป็นคอนเทนต์ขายดี พร้อมหลักฐานยอดขายจริง (Social Proof)
* **🚀 Automatic Trigger on Order Shipped:** เมื่อเปลี่ยนสถานะคำสั่งซื้อเป็น **"จัดส่งแล้ว" (`shipped`)** (ทั้งจากตารางหลักและหน้าต่างแก้ไข) ระบบ AI จะสร้างดราฟต์บทความ SEO Blog และส่งแจ้งเตือนเข้า Telegram แอดมินอัตโนมัติทันที
* **⚡ 1-Click Telegram Approval for Website Post:** ใน Telegram แจ้งเตือนจะมีปุ่ม **`🌐 ✅ อนุมัติโพสต์ลง Website (SEO Blog)`** ให้แอดมินกดอนุมัติเผยแพร่ขึ้น `sealthai.com/blog/` ได้ทันทีในคลิกเดียว

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
