# 📋 SEALTHAI Shop Dashboard — Changelog & Update History

เอกสารบันทึกประวัติการพัฒนาและอัปเกรดระบบ SEALTHAI Shop Dashboard & AI Operations

## 🚀 [v2.31] — 2026-09-23
### Fix: Purchase Order (PO) Save & Draft Validation (แก้ไขการบันทึกแบบร่าง PO และป้องกันข้อผิดพลาด Item Code ว่าง)
* **🛡️ ลบเงื่อนไขบล็อก Item Code ว่าง & ระบบ Auto-fill อัจฉริยะ (`savePO`):**
  - ล้างแถวว่างที่ไม่ได้เลือกสินค้าออกให้อัตโนมัติ (เช่น กด `+ เพิ่ม SKU` เผื่อไว้แต่ไม่ได้เลือกสินค้า)
  - ระบบจะเติมรหัส SKU, ชื่อสินค้า, และราคาซื้อเข้าให้อัตโนมัติจากฐานข้อมูลสินค้าหลัก (`p.sku || p.supplier_sku || p.name`)
  - รองรับการกด **"💾 บันทึกแบบร่าง (Draft PO)"** และ **"📤 ส่ง PO"** ได้อย่างราบรื่น ไม่มีข้อความแจ้งเตือนบล็อกกวนใจ
* **🧹 Cache Refresh (v2.31):** อัปเดต Service Worker Cache เป็น `sealthai-v2.31`

---

## 🚀 [v2.30] — 2026-09-23
### Fix: PO & Order Autocomplete Dropdown Selection (แก้ไขปัญหาคลิกเลือกสินค้าในดรอปดาวน์แล้วเด้งกลับไปเลือกรายการแรก)
* **🎯 ป้องกันการเกิด Blur ก่อนการคลิกเลือกสินค้า (`onmousedown` & `_poAutocompleteClicking`):**
  - แก้ไข Event ในดรอปดาวน์ผลการค้นหาสินค้าทั้งในหน้า **Purchase Order (PO)** และหน้า **คำสั่งขาย (Order)** ให้ใช้ `onmousedown` พร้อม `event.preventDefault()` เพื่อป้องกันไม่ให้ช่องค้นหาหลุดโฟกัส (Blur) ก่อนที่การคลิกเลือกสินค้าจะประมวลผลเสร็จ
* **⚡ ปรับปรุงการตรวจสอบตอนหลุดโฟกัส (`handlePOProdBlur` & `handleOrderProdBlur`):**
  - ยกเลิกการค้นหาแบบสุ่ม Fuzzy Match ในขั้นตอน Blur เพื่อป้องกันการเด้งไปเลือกสินค้าแรกที่บังเอิญมีตัวเลขตรงกัน (เช่น พิมพ์ค้นหา `22X31X5` แล้วคลิกเลือกรายการที่ 2 แต่ระบบเด้งไปเลือกรายการที่ 1)
  - รองรับการคลิกเลือกสินค้าทุกแถวในรายการผลลัพธ์ได้อย่างแม่นยำ 100%
* **🧹 Cache Refresh (v2.30):** อัปเดต Service Worker Cache เป็น `sealthai-v2.30`

---

## 🚀 [v2.29] — 2026-09-23
### Quick Product Creation: USD Currency Support (สร้างสินค้าใหม่เข้าคลังด่วน รองรับหน่วยเงิน USD / ค่าเริ่มต้น THB)
* **💵 ตัวเลือกสกุลเงินในหน้าสร้างสินค้าด่วน (`openQuickProductModal` & `modal-quick-product`):**
  - เพิ่มตัวเลือก **สกุลเงินของราคา (Currency)** ให้สามารถเลือกได้ระหว่าง **`฿ THB (บาทไทย)`** และ **`$ USD (ดอลลาร์สหรัฐ)`**
  - **ตั้งค่าเริ่มต้นเป็น THB (บาทไทย)** ตามที่ผู้ใช้ต้องการ
* **💱 อัตราแลกเปลี่ยนและการแปลงค่าเงินอัตโนมัติ (`calcQPConvertedPreview` & `toggleQPCurrency`):**
  - เมื่อเลือกเป็น USD ระบบจะเปิดช่องกรอกอัตราแลกเปลี่ยน `อัตราแลกเปลี่ยน (THB / 1 USD)` อัตโนมัติ (Default: 35.00 บาท หรือดึงจากใบสั่งซื้อ PO ที่กำลังเปิดอยู่)
  - ปรับป้ายราคาขายและราคาต้นทุนเป็น `$ USD / ชิ้น` พร้อมแสดงพรีวิวราคาแปลงเป็นเงินบาท `≈ ฿... (คิดเป็นเงินบาท)` แบบ Real-time ทันทีที่พิมพ์
  - ระบบจะแปลงเป็นมูลค่าเงินบาทสำหรับบันทึกเก็บเข้าคลังสินค้าหลักอย่างถูกต้อง และส่งต่อราคาสั่งซื้อไปยังฟอร์ม PO / Order ตามสกุลเงินของเอกสารให้อัตโนมัติ
* **🧹 Cache Refresh (v2.29):** อัปเดต Service Worker Cache เป็น `sealthai-v2.29`

---

## 🚀 [v2.28] — 2026-09-23
### Purchase Order SKU Management: Search & Add Items like Orders (ค้นหา & เพิ่มรายการ SKU สั่งซื้อได้เหมือนหน้าออเดอร์)
* **🛒 ยกระดับการค้นหา & เพิ่มรายการ SKU ในใบสั่งซื้อ (PO Modal — `renderPOItems` & `newPOProdSearch`):**
  - ช่องค้นหาสินค้าอัจฉริยะแบบ Real-time (`newPOProdSearch`): ค้นหาได้ทั้งชื่อสินค้า, รหัส SKU, Supplier SKU, และขนาด พร้อมระบบค้นหาอัตโนมัติจาก Supabase (Async Database Fallback)
  - หน้าต่างดรอปดาวน์แสดงผลละเอียด: แสดงชื่อสินค้าเด่นชัด, ป้ายรหัส SKU, Supplier SKU, Part No, ป้ายสถานะสต๊อกคงเหลือ (`📦 คงเหลือ X ชิ้น` หรือ `⚠️ หมด`), ป้ายราคาซื้อเข้าจาก Supplier (`🏷️ ราคาซื้อเข้า: ฿X`), ราคาทุนเฉลี่ย, และปุ่มลัด `➕ สร้างสินค้าใหม่เข้าคลัง`
  - การแสดงผลหลังเลือกสินค้า: แสดงป้าย `✓ เชื่อมโยงคลัง`, ป้ายสต๊อก, ป้ายราคาซื้อเข้า, และปุ่มลัด 1-คลิกคัดลอก (Copy SKU / Supplier SKU)
  - ช่องพิมพ์ข้อความสเปก/ชื่อเฉพาะในเอกสาร PO สำหรับส่งให้ Supplier (`🏷️ 2. ข้อความพิมพ์ในเอกสาร PO / สเปกส่ง Supplier`)
  - ปุ่ม `+ เพิ่มรายการสินค้า (SKU)` ด้านล่างและ `➕ สร้างสินค้าใหม่เข้าคลัง` ด้านบน
* **➕ เพิ่มสินค้าในหน้าสร้าง PO รวมจากออเดอร์ขาย (`openBatchSOtoPOModal`):**
  - เพิ่มปุ่ม **"➕ เพิ่มสินค้า / SKU ใน PO นี้"** (`openAddProductToBatchPOModal`) เพื่อให้สามารถค้นหาสินค้าจากคลังและสั่งซื้อเพิ่มเติมในใบสั่งซื้อเดียวกันได้อย่างสะดวกรวดเร็ว
* **🧹 Cache Refresh (v2.28):** อัปเดต Service Worker Cache เป็น `sealthai-v2.28`

---

## 🚀 [v2.27] — 2026-09-23
### Goods Return & Credit Note (CN): Direct Integration from AR Invoice (รับคืนสินค้าโดยดึงข้อมูลจาก AR Invoice)
* **📥 ระบบเลือกดึงข้อมูลจาก AR Invoice (`openARPickerForReturn`):**
  - เพิ่มปุ่ม **"📥 ดึงข้อมูลจาก AR Invoice"** ในหน้า **รับคืนสินค้า / Credit Note (CN)** และหน้าต่างบันทึกรับคืนใหม่ (`openNewGR`)
  - หน้าต่างค้นหา AR Invoice แบบ Real-time รองรับการค้นหาตามเลขที่ Invoice (AR), เลขที่คำสั่งขาย (SO), หรือชื่อลูกค้า พร้อมแสดงยอดหนี้คงค้างและปุ่มคลิกรับคืนสินค้าได้ทันที
* **🧾 รองรับการรับคืนทั้งแบบมี SO และ Standalone Invoice (`openReturnFromAR`):**
  - **Invoice ที่ผูกกับ Sales Order:** ดึงรายการสินค้า, ราคาขาย, จำนวนที่ซื้อมาให้อัตโนมัติ เลือกระบุจำนวนที่ต้องการรับคืนได้
  - **Invoice ทั่วไป (Standalone):** สามารถเลือกสินค้าจากคลัง ระบุจำนวน และราคาคืนได้สะดวกรวดเร็ว
* **📦 สต๊อกและการเงินอัปเดตอัตโนมัติครบวงจร:**
  - เพิ่มสต๊อกสินค้ากลับเข้าคลังอัตโนมัติ (`stock_movements` [move_type: in] พร้อมรัน `recalcStockQty`)
  - บันทึกประวัติการรับคืนใน `goods_returns` และ `goods_return_items`
  - ปรับลดยอดรวมและยอดค้างชำระใน `ar_invoices` (หากชำระเงินมาแล้วเกินยอดหลังหักคืน จะบันทึกคืนเงินส่วนเกินใน `ar_payments` อัตโนมัติ)
  - ปรับปรุงสถานะคำสั่งขาย (`orders`) และรายการสินค้า (`order_items`) ที่เกี่ยวข้อง
* **⚡ เพิ่มปุ่ม "🧾 รับคืนสินค้า (CN)" ในหน้าต่างรายละเอียด AR Invoice (`openARDetail`):** รองรับการคลิกรับคืนสินค้าได้โดยตรงจากทุก Invoice
* **🧹 Cache Refresh (v2.27):** อัปเดต Service Worker Cache เป็น `sealthai-v2.27`

---

## 🚀 [v2.20] — 2026-09-19
### Print Options Modal: Original, Copy & Dual Batch Printing (เลือกพิมพ์ ต้นฉบับ / สำเนา / เป็นชุด 2 หน้า)
* **🖨️ ตัวเลือกประเภทเอกสารในหน้าต่างพิมพ์บิล (`openReceiptOptions`):**
  - **🌟 ต้นฉบับเท่านั้น (ORIGINAL):** พิมพ์ 1 ใบ หัวบิลระบุ `( ต้นฉบับ / ORIGINAL )` เหมาะสำหรับมอบให้ลูกค้า
  - **📑 สำเนาเท่านั้น (COPY):** พิมพ์ 1 ใบ หัวบิลระบุ `( สำเนา / COPY )` โทนสี Slate Grey สวยงาม เหมาะสำหรับเก็บเข้าแฟ้มบัญชี
  - **✨ พิมพ์เป็นชุด (ต้นฉบับ + สำเนา):** พิมพ์ 2 หน้า A4 ต่อกันในคำสั่งเดียว สะดวก รวดเร็ว ไม่ต้องกดสั่งพิมพ์ 2 ครั้ง
* **🖋️ ปรับเปลี่ยนลายเซ็นใหม่ & ตั้งค่าเริ่มต้น:**
  - นำไฟล์ลายเซ็น "นันทนา" หมึกสีน้ำเงินธรรมชาติอันใหม่มาสกัดขอบโปร่งใส (Transparent Background) ความละเอียดสูง
  - ปรับขนาดลายเซ็นให้กะทัดรัดลง 60% (`max-width: 72px; max-height: 24px;`) วางบนเส้นบรรทัดลงนามอย่างพอดีและสง่างาม
  - ตั้งค่าตัวเลือก "พิมพ์ลายเซ็นผู้รับเงิน" ใน Modal เป็น **ปิดเป็นค่าเริ่มต้น (Default: Unchecked)** เพื่อให้ผู้ใช้เลือกติ๊กเปิดเฉพาะเวลาที่ต้องการ
* **📄 Perfect Multi-Page A4 Layout:** รองรับการแบ่งหน้าเอกสารอัตโนมัติ (`page-break-after: always`) พร้อมพรีวิวหน้ากระดาษเสมือนจริงบนหน้าจอ
* **🧹 Cache Refresh (v2.20):** อัปเดตเวอร์ชันระบบเป็น `sealthai-v2.20`

---

## 🚀 [v2.19] — 2026-09-19
### Print Templates: ORIGINAL Badge & Blue Pen Ink Signature (พิมพ์บิลต้นฉบับ & ลายเซ็นสีน้ำเงิน)
* **📑 ระบุสถานะ "ต้นฉบับ" (ORIGINAL) ในหัวเอกสาร:**
  - เพิ่มป้ายกำกับ **`( ต้นฉบับ / ORIGINAL )`** ใต้ชื่อเอกสารทั้งใน **บิลเงินสด (Cash Sale)**, **ใบเสนอราคา (Quotation)** และ **ใบสั่งซื้อ (Purchase Order)** เพื่อความถูกต้องตามมาตรฐานเอกสารทางธุรกิจและการบัญชี
* **🖋️ ลายเซ็นหมึกสีน้ำเงิน (Authentic Blue Pen Ink):**
  - ปรับการแสดงผลรูปภาพลายเซ็นผู้รับเงิน/ผู้เสนอราคา (`.sig-image`) ด้วย CSS Color Inversion & Hue Matrix ให้เปลี่ยนเป็น **หมึกปากกาสีน้ำเงินสดใส (`#1d4ed8` / Genuine Blue Pen Ink)** อัตโนมัติ สวยงาม คมชัด เสมือนการลงนามด้วยปากกาจริง
  - ปรับสีเส้นบรรทัดสำหรับลงลายเซ็น (`.sig-line`) และข้อความตำแหน่ง (`.sig-label`) ให้เป็นโทนสีน้ำเงิน เข้ากับลายเซ็นอย่างลงตัว
* **🧹 Cache Refresh (v2.19):** อัปเดตเวอร์ชันระบบและเลย์เอาต์พิมพ์บิลเป็น `sealthai-v2.19`

---

## 🚀 [v2.18] — 2026-09-19
### Product Search: Top-Positioned Results Layout (ย้ายผลการค้นหาขึ้นด้านบนทันที ทั้ง Mobile & PC)
* **🔍 Instant Top-Positioned Results:** ปรับเปลี่ยนเลย์เอาต์หน้าสินค้า (Products) ให้ตารางรายการสินค้า (PC) และการ์ดสินค้า (Mobile) แสดงผล **ด้านบนสุด** ติดกับกล่องค้นหาทันทีที่ผู้ใช้พิมพ์ค้นหาหรือเลือกตัวกรอง ช่วยให้ค้นหาและมองเห็นข้อมูลสินค้าได้ทันทีโดยไม่ต้องเลื่อนหน้าจอ (Zero Scroll)
* **📱 Clean & Focused Mobile/Desktop View:** ระหว่างที่พิมพ์ค้นหาหรือเปิดฟิลเตอร์ ระบบจะซ่อนส่วนสถิติและ Category Dashboard ชั่วคราว เพื่อเปิดพื้นที่หน้าจอให้แสดงรายการสินค้าที่ตรงกับคำค้นหาได้อย่างเต็มที่
* **🏷️ Active Search Banner:** เพิ่มแถบแสดงสถานะผลการค้นหา `🔍 ผลการค้นหา: "..." (พบ X รายการ)` พร้อมปุ่ม `✕ ล้างการค้นหา` เพื่อสลับกลับไปดูภาพรวมหมวดหมู่ทั้งหมดได้ในคลิกเดียว
* **⚡ 1-Tap Quick Filters at Top:** ปุ่มลัดตัวกรอง (TC, O-Ring, Viton, PU, สต๊อก=0, รอเข้า PO, รอส่ง SO) จะแสดงผลการกรองที่ด้านบนทันที
* **🧹 Cache Refresh (v2.18):** อัปเดต Service Worker Cache เป็น `sealthai-v2.18`

---

## 🚀 [v2.17] — 2026-09-18
### Purchase Order: Use Supplier Quoted Purchase Price (Not Average Cost)
* **🛒 Direct Purchase Price Priority (ราคาซื้อเข้าจาก Supplier):** ปรับปรุงระบบดึงราคาในใบสั่งซื้อ (Purchase Order / PO) ทุกฟังก์ชัน ให้ดึง **"ราคาซื้อเข้า" (`purchase_price` / `buy_price`)** ที่ตั้งไว้สำหรับอ้างอิงกับซัพพลายเออร์โดยตรง โดยไม่ดึงราคาทุนเฉลี่ยในคลัง (`current_cost`):
  - **เปิดใบสั่งซื้อใหม่ (`openNewPO`):** ดึง `purchase_price` จากฐานข้อมูลสินค้าสำหรับรายการสินค้าที่เลือก
  - **ระบบค้นหา & Autocomplete (`renderPOItems`):** แสดงป้ายราคา `ราคาซื้อเข้า: ฿...` อย่างเด่นชัด พร้อมใส่ราคาซื้อเข้าลงในช่องราคาอัตโนมัติเมื่อเลือกสินค้า
  - **สร้าง PO รวมจากออเดอร์ขาย (`openBatchSOtoPOModal`):** ดึงราคาซื้อเข้าของสินค้าที่อ้างอิงจาก Supplier เป็นหลัก (เช่น `OIL SEAL NBR 9X16X4` ราคาซื้อเข้า = ฿9)
  - **สั่งซื้อสินค้าซื้อซ้ำ (`createPOFromSelectedRepeat`):** ดึงราคาซื้อเข้าที่ตั้งไว้โดยตรง
  - **สั่งซื้อจาก Stock Planning (`createPOFromSelectedPlanning`):** ดึงราคาซื้อเข้าที่ตั้งไว้
* **🎯 Accurate Supplier Pricing:** รองรับการอ้างอิงราคาซื้อเข้าของซีลและอะไหล่ทุกขนาดตรงตามราคาต้นทางจาก Supplier 100%
* **🧹 Cache Refresh (v2.17):** อัปเดต Service Worker Cache เป็น `sealthai-v2.17`

---

## 🚀 [v2.16] — 2026-09-17
### Customer Database & Auto-Sync from Orders (ระบบจัดการฐานข้อมูลลูกค้าจากออเดอร์)
* **📥 One-Click Customer Sync (`syncCustomersFromOrders`):** เพิ่มฟีเจอร์และปุ่ม **"📥 ดึงลูกค้าจากออเดอร์"** ในหน้ารายชื่อลูกค้า (`customers`) ทั้งใน Top Toolbar, Card Header และ Empty State:
  - สแกนข้อมูลประวัติออเดอร์ทั้งหมดในระบบ
  - จัดกลุ่มและรวมข้อมูลลูกค้าอัตโนมัติตามชื่อ เบอร์โทรศัพท์ และเลขผู้เสียภาษี
  - จำแนกประเภทลูกค้าอัจฉริยะ (🏢 นิติบุคคล/บริษัท หรือ 👤 บุคคลธรรมดา)
  - ดึงข้อมูลเบอร์โทร, ที่อยู่จัดส่ง, ช่องทางการสั่งซื้อ, ยอดใช้จ่ายรวม, และจำนวนออเดอร์
  - บันทึกลงในตารางฐานข้อมูล `customers` บน Supabase แบบ Upsert ถาวร เพื่อใช้ค้นหา วิเคราะห์ และใช้งานในอนาคต
* **⚡ Real-time Order Auto-Sync (`autoSyncCustomerFromOrder`):** เมื่อมีการสร้างออเดอร์ใหม่ (`saveOrder`) หรือแก้ไขออเดอร์ (`saveOrderEdit`) ระบบจะทำการบันทึก/อัปเดตข้อมูลลูกค้าลงฐานข้อมูล `customers` ให้แบบอัตโนมัติทันที
* **🔍 Seamless Search & 360° Profile:** ค้นหาลูกค้าได้ง่าย รวดเร็ว พร้อมเชื่อมโยงประวัติคำสั่งซื้อทั้งหมดของลูกค้าในหน้าต่าง Customer 360° Profile (`openCustomerProfileModal`) ทั้งจาก `customer_id` และ `customer_name`
* **🧹 Cache Refresh (v2.16):** อัปเดต Service Worker Cache เป็น `sealthai-v2.16`

---
### Monthly Summary: Staff Wages, Commissions & Gratuity in Details Table
* **💼 คอลัมน์ค่าแรง (Staff Wages):** เพิ่มคอลัมน์ **"💼 ค่าแรง"** ในตาราง **📋 รายละเอียด** ของหน้าสรุปยอดขายรายเดือน (`monthly`):
  - คำนวณค่าแรง CFO (นันทนา 15% ของกำไรหลังหัก GP Platform) รายวัน
  - รวมยอดค่าแรง/เงินเดือนพนักงานที่บันทึกในระบบ
  - ตัวเลขสามารถคลิกดูรายละเอียด (`drillDailyWage`) เพื่อดูสูตรการคิดและรายการจ่ายได้ทันที
* **👤 คอลัมน์ค่าคอมพนักงาน (Sales Commission):** เพิ่มคอลัมน์ **"👤 ค่าคอม"** ในตาราง **📋 รายละเอียด**:
  - แสดงค่าคอมมิชชั่นฝ่ายขาย (นิติ บุญสายันต์ 15% ของกำไรหลังหัก GP Platform) ในแต่ละวันอย่างโปร่งใส
  - สามารถคลิกดูรายละเอียด (`drillDailyCommission`) ได้
* **🎁 คอลัมน์ค่าสินน้ำใจ (Gratuity & Top Up):** เพิ่มคอลัมน์ **"🎁 สินน้ำใจ"** ในตาราง **📋 รายละเอียด**:
  - แสดงค่าสินน้ำใจและเงินพิเศษ Supplier แยกต่างหากอย่างชัดเจน
  - สามารถคลิกดูรายละเอียด (`drillDailyGratuity`) ได้
* **📊 Stat Cards สรุปยอดครบถ้วน:** เพิ่มการ์ดสถิติด้านบนสำหรับ `💼 ค่าแรงรวม`, `👤 ค่าคอมพนักงาน`, และ `🎁 ค่าสินน้ำใจ` พร้อมคลิกดูสรุปประจำงวดได้
* **✨ สูตรกำไรสุทธิสมบูรณ์ 100%:** กำไรสุทธิคำนวณหักต้นทุนสินค้า, ค่าธรรมเนียม GP Platform, ค่าแรง, ค่าคอมมิชชั่น, ค่าสินน้ำใจ, และค่าใช้จ่ายดำเนินงาน สอดคล้องตรงกับระบบบัญชีและ Dashboard ภาพรวม 100%
* **🧹 Cache Refresh (v2.15):** อัปเดต Service Worker Cache เป็น `sealthai-v2.15`

---

## 🚀 [v2.14] — 2026-09-16
### Monthly Summary: Interactive Drilldown for Daily Expenses & Other Income
* **💸 Daily Expense Breakdown Modal (`drillDailyExpenses`):** สามารถคลิกที่ตัวเลขยอด **💸 ค่าใช้จ่าย** ในตาราง **📋 รายละเอียด** ของแต่ละวัน เพื่อเปิดหน้าต่างดูรายละเอียดค่าใช้จ่ายที่เกิดขึ้นในวันนั้นได้ทันที:
  - แสดงหมวดหมู่ค่าใช้จ่าย, รายละเอียดรายการ, ผู้รับเงิน/ร้านค้า, ยอดเงิน, และช่องทางการชำระ
  - แถวสรุปรวมท้ายตาราง (`tfoot`) สามารถคลิกดูรายการค่าใช้จ่ายทั้งหมดของเดือนได้เช่นกัน
* **📈 Daily Other Income Breakdown Modal (`drillDailyOtherIncome`):** สามารถคลิกที่ตัวเลขยอด **📈 รายได้อื่น** ในตาราง **📋 รายละเอียด** ของแต่ละวัน เพื่อเปิดหน้าต่างดูรายละเอียดรายได้อื่นๆ ในวันนั้น:
  - แสดงประเภทรายได้, หัวข้อ, รายละเอียด, และยอดกำไร/รายได้ที่รับรู้
  - แถวสรุปรวมท้ายตาราง (`tfoot`) สามารถคลิกดูรายการรายได้อื่นทั้งหมดของเดือนได้
* **🧹 Cache Refresh (v2.14):** อัปเดต Service Worker Cache เป็น `sealthai-v2.14`

---

## 🚀 [v2.13] — 2026-09-16
### Monthly Summary: Prominent Daily Bill / Order Count Column in Details Table
* **📑 Prominent Daily Bill Count Column:** เพิ่มคอลัมน์ **"📑 จำนวนบิล"** ในตำแหน่งเด่นชัดถัดจากวันที่ในตาราง **📋 รายละเอียด** ของหน้าสรุปยอดขายรายเดือน (`monthly`) พร้อมป้าย `🛒 X บิล` สีฟ้าสดใสที่สามารถคลิกเพื่อเปิดดูรายการออเดอร์ของวันนั้นๆ ได้ทันที
* **🔢 Monthly Order Summary Badge:** แสดงยอดรวมจำนวนบิลทั้งหมดของเดือน/งวดที่เลือกในแถวสรุปรวมท้ายตาราง (`tfoot`)
* **📱 Enhanced Mobile Daily Overview:** แสดงป้าย `🛒 X บิล` เคียงคู่กับวันที่ในมุมมองมือถือ ช่วยให้ตรวจสอบจำนวนออเดอร์ในแต่ละวันได้อย่างรวดเร็ว
* **🧹 Cache Refresh (v2.13):** อัปเดต Service Worker Cache เป็น `sealthai-v2.13`

---

## 🚀 [v2.12] — 2026-09-16
### Monthly Summary Page: Shopee & Lazada Platform GP Fee Breakdown in Detail Table
* **📊 Platform GP Fee Columns in Monthly Details Table:** เพิ่มคอลัมน์แสดงค่าธรรมเนียม GP Platform ในตาราง **📋 รายละเอียด** ของหน้าสรุปยอดขายรายเดือน (`monthly`) อย่างละเอียด:
  - 🟠 **GP Shopee:** แสดงยอดค่าธรรมเนียม Shopee ในแต่ละวัน
  - 🔵 **GP Lazada:** แสดงยอดค่า GP Lazada ในแต่ละวัน
  - 💸 **รวม GP Platform:** รวมยอดค่าธรรมเนียม Platform ทั้งหมดในแต่ละวัน
* **📈 Enhanced Daily Net Profit Formula:** ปรับปรุงสูตรคำนวณกำไรสุทธิรายวันและกำไรสะสม ให้หักค่าธรรมเนียม GP Platform (Shopee/Lazada) ครบถ้วนตรงตามหลักบัญชีจริง
* **🔍 Interactive Platform GP Drilldown Modal:** เพิ่มการ์ดสถิติ `💸 GP Platform` ด้านบน พร้อมฟังก์ชันคลิกดูรายการออเดอร์ Shopee / Lazada ที่ถูกหักค่าธรรมเนียมรายรายการ
* **🧹 Cache Refresh (v2.12):** อัปเดต Service Worker Cache เป็น `sealthai-v2.12`

---

## 🚀 [v2.11] — 2026-09-16
### Fix Owner Dashboard Loading & CFO Wage Variable Scope
* **🏠 Owner Dashboard Data Display Restored:** แก้ไขปัญหาข้อมูลใน **กระดานผู้บริหาร (Owner Dashboard)** ไม่แสดงผล โดยแก้ไขตัวแปร `CFO_WAGE_PCT` (อัตราค่าแรง CFO 15%) ให้เข้าถึงได้ทั่วทั้งระบบในระดับ Global Scope
* **📊 Complete Executive Metrics:** แสดงผลข้อมูลครบถ้วนทั้ง ยอดขายรวม, ต้นทุนสินค้า (COGS), ค่าใช้จ่ายดำเนินงาน, กำไรสุทธิทางบัญชี, กราฟแท่งเปรียบเทียบยอดขาย vs ต้นทุน vs กำไรสุทธิย้อนหลัง (6/12 เดือน), กราฟกำไรสะสม, การแจ้งเตือนสต๊อก, ออเดอร์ล่าสุด, และ KPI พนักงาน
* **🛡️ Fail-Safe Try/Catch Wrapper:** เพิ่มระบบดักจับข้อผิดพลาดใน `loadDashData` พร้อมข้อความแจ้งเตือนที่ชัดเจนหากเกิดปัญหาการเชื่อมต่อ
* **🧹 Cache Refresh (v2.11):** อัปเดต Service Worker Cache เป็น `sealthai-v2.11`

---

## 🚀 [v2.10] — 2026-09-16
### Instant Document Detail Viewer for Inventory Posting List (PO & SO Support)
* **📜 Instant Document Viewer Modal (`modal-doc-viewer`):** เพิ่มหน้าต่างป๊อปอัปดูรายละเอียดเอกสารแบบรวดเร็ว เมื่อคลิกที่เลขที่เอกสารในหน้าต่าง **Inventory Posting List & ประวัติสต๊อก** สามารถเปิดดูข้อมูลฉบับเต็มได้ทันทีโดยไม่ต้องสลับหน้า:
  - **🛒 Purchase Order (PO):** แสดงรายละเอียดใบสั่งซื้อครบถ้วน (ชื่อ Supplier, ผู้ติดต่อ, รายการสินค้า, จำนวนสั่ง, จำนวนรับแล้ว, ยอดค้างรับ, ราคาซื้อ, ยอดรวม) พร้อมปุ่ม `🖨️ พิมพ์ใบสั่งซื้อ (PO)` และ `✏️ ไปที่หน้า PO`
  - **📄 Sale Order (SO):** แสดงรายละเอียดออเดอร์ขายครบถ้วน (ชื่อลูกค้า, เบอร์โทร, ที่อยู่จัดส่ง, ช่องทางขาย, Tracking, ส่วนลด, ยอดชำระสุทธิ) พร้อมปุ่ม `🖨️ พิมพ์บิลเงินสด (Cash Sale)` และ `✏️ ไปที่หน้าออเดอร์`
  - **🔵 Goods Return (GR):** แสดงรายละเอียดใบคืนสินค้า
* **🖨️ Quick Print Buttons:** เพิ่มปุ่มไอคอน `🖨️` ในแต่ละแถวของตารางเพื่อกดพิมพ์บิลเงินสด / ใบสั่งซื้อได้ทันที
* **🐛 Print & ReferenceError Fix:** แก้ไขฟังก์ชัน `printPO` (กำหนดตัวแปร `shop` ให้ถูกต้อง) ป้องกันข้อผิดพลาด JavaScript เมื่อสั่งพิมพ์ใบสั่งซื้อ
* **🧹 Cache Refresh (v2.10):** อัปเดต Service Worker Cache เป็น `sealthai-v2.10`

---

## 🚀 [v2.09] — 2026-09-16
### Period-over-Period Growth Percentage Comparison Badges (▲ Green / ▼ Red)
* **📊 Period-over-Period Growth Comparison:** เพิ่มป้ายแสดง `%` การเติบโตเปรียบเทียบกับรอบก่อนหน้าบนการ์ดสถิติ (Stat Cards) ทุกกล่องใน Dashboard ภาพรวม:
  - **รายเดือน (`monthly`):** เปรียบเทียบกับเดือนก่อนหน้า (เช่น ก.ย. เทียบ ส.ค., ส.ค. เทียบ ก.ค.)
  - **รายวัน (`daily`):** เปรียบเทียบกับเมื่อวาน (Yesterday)
  - **รายสัปดาห์ (`weekly`):** เปรียบเทียบกับสัปดาห์ก่อนหน้า (Previous Week)
  - **ราย 3 เดือน (`3month`):** เปรียบเทียบกับ 3 เดือนก่อนหน้า (Previous 3 Months)
  - **รายปี (`yearly`):** เปรียบเทียบกับปีก่อนหน้า (Previous Year)
* **🟢 Visual Trend Indicators (▲ เขียว / ▼ แดง):** แสดงลูกศรชี้ขึ้นสีเขียว `▲ +X.X%` เมื่อยอดเติบโตขึ้น และลูกศรชี้ลงสีแดง `▼ -X.X%` เมื่อยอดลดลง เพื่อให้เห็นทิศทางผลการดำเนินงานได้ชัดเจนทันที
* **🎯 Inverted Sentiment for Expenses & Cancellations:** สำหรับการ์ดกลุ่มค่าใช้จ่าย (`💸 ค่าใช้จ่าย`, `🚢 Landed Cost`, `🎁 สินน้ำใจ Supplier`) และ `❌ ออเดอร์ยกเลิก` ระบบจะสลับสีอัจฉริยะ (ถ้าลดลงจะแสดงเป็นสีเขียว ถ้าเพิ่มขึ้นจะแสดงเป็นสีแดง) เพื่อสะท้อนสุขภาพทางการเงินที่ถูกต้อง
* **🧹 Cache Refresh (v2.09):** อัปเดต Service Worker Cache เป็น `sealthai-v2.09`

---
### Accurate Period-Aware Daily Average Sales Calculation
* **📊 Accurate Daily Average Sales Calculation:** ปรับปรุงสูตรคำนวณ "ค่าเฉลี่ย/วัน" ให้คิดตามจำนวนวันจริงของช่วงเวลาและเดือนที่เลือก:
  - **เดือนที่เลือกในอดีต (เช่น สิงหาคม):** หารด้วยจำนวนวันเต็มของเดือนนั้น ($31$ วัน) $\rightarrow$ $\text{฿}48,827.38 \div 31 = \text{฿}1,575.08$/วัน (แก้ปัญหาการหารด้วยวันที่ 15 ของเดือนปัจจุบัน)
  - **เดือนปัจจุบัน (กันยายน):** หารด้วยจำนวนวันที่ดำเนินมาถึง ($15$ วัน)
  - **มุมมองราย 3 เดือน / รายปี:** คำนวณจำนวนวันจริงตามช่วงเวลา
* **📅 Explicit Subtitle:** ระบุจำนวนวันและสูตรการหารอย่างชัดเจนใต้การ์ดสถิติ
* **🧹 Cache Refresh (v2.08):** อัปเดต Service Worker Cache เป็น `sealthai-v2.08`

---

## 🚀 [v2.07] — 2026-09-15
### Fix JavaScript Syntax & Universal Product Image Support
* **🐛 Critical Syntax Fix (Unexpected Identifier 'none'):** แก้ไขเครื่องหมายคำพูด (Quote Escape) ในแท็กรูปภาพตารางสินค้า ทำให้ JavaScript ทำงานได้อย่างราบรื่นและสามารถล็อกอินเข้าสู่ระบบได้ทันที 100%
* **🖼️ Universal Product Image Support:** ปรับปรุงฟังก์ชัน `getProductImageUrl` ให้รองรับการดึงรูปภาพจากทุกฟิลด์ในฐานข้อมูล (`image_url`, `imageUrl`, `photo_url`, `image`, `cover_image`, `images`) พร้อมแสดงผลในการ์ดสินค้าและตาราง
* **🧹 Cache Refresh (v2.07):** อัปเดต Service Worker Cache เป็น `sealthai-v2.07`

---

## 🚀 [v2.06] — 2026-09-15
### Guaranteed Fast Login & Instant App Access
* **⚡ Instant Login Transition:** ปรับปรุงขั้นตอนการเข้าสู่ระบบให้แสดงผลหน้าแดชบอร์ดทันที ไม่ติดค้างหน้าต่างเข้าสู่ระบบ แม้ในกรณีที่การเชื่อมต่อ Supabase ล่าช้า
* **🛡️ Fail-Safe Authentication:** ปรับแต่ง `afterLogin` ให้เป็น async/await ที่มีความเสถียร 100% พร้อมระบบสำรองสิทธิ์การใช้งานแอดมินอัตโนมัติ
* **🧹 Cache Refresh (v2.06):** อัปเดต Service Worker Cache เป็น `sealthai-v2.06`

---

## 🚀 [v2.05] — 2026-09-15
### Responsive PC Product Table (No Horizontal Scroll / Full Width View)
* **🖥️ No Horizontal Scroll on PC View:** ปรับปรุงโครงสร้างตารางรายการสินค้าหลักบนหน้าจอคอมพิวเตอร์ (PC / Laptop) ให้แสดงผลเต็มความกว้าง 100% โดยไม่ต้องเลื่อนแถบ Scrollbar ซ้าย-ขวา (No horizontal scroll)
* **📦 Smart Grouped Information:** รวมข้อมูลให้อ่านง่ายและกระชับในคอลัมน์สำคัญ:
  - **สินค้า & รหัส:** ชื่อสินค้า, ป้ายหมวดหมู่, SKU, Supplier SKU, Part No, และตำแหน่งชั้นวาง
  - **ราคา & กำไร:** ราคาขาย, กำไรต่อชิ้น, และราคาซื้อมาตรฐาน
  - **สต๊อก & มูลค่า:** สต๊อกคงเหลือรวม (คลิกดูประวัติสต๊อกได้ทันที), แยกคลังร้าน, Ecoseal, และมูลค่าสต๊อก
  - **รอเข้า (PO) & รอส่ง (SO):** ป้ายสถานะการเคลื่อนไหวสินค้าชัดเจน
* **⚡ Compact Quick Actions:** ปุ่มจัดการสินค้า (`📜 สต๊อก`, `✏️ แก้ไข`, `🙈 ซ่อน`, `🗑️ ลบ`) ในขนาดกะทัดรัด
* **🧹 Cache Refresh (v2.05):** อัปเดต Service Worker Cache เป็น `sealthai-v2.05`

---

## 🚀 [v2.04] — 2026-09-15
### Pull Purchase Price (Not Average Cost) for Purchase Order Items & SKU Autocomplete
* **🛒 Direct Purchase Price in PO:** ปรับระบบเลือกสินค้า/SKU ในการสร้างใบสั่งซื้อ (Purchase Order / PO) ให้ดึงราคาซื้อมาตรฐาน (`purchase_price`) จากฐานข้อมูลสินค้าโดยตรง ไม่ดึงราคาทุนเฉลี่ย (`current_cost`)
* **🔍 Enhanced PO Search & Autocomplete:** เมนูค้นหาและเลือก SKU ในฟอร์ม PO แสดงชื่อสินค้า, Supplier SKU, สต๊อกคงเหลือจริง และป้าย `ราคาซื้อ: ฿...` สีเขียวเด่นชัด พร้อมระบุทุนเฉลี่ยเพื่อการเปรียบเทียบ
* **🏷️ Linked Product Price Badge:** แถบสถานะการเชื่อมโยงสินค้าใต้ช่อง SKU แสดงราคาซื้อมาตรฐานของสินค้าที่บันทึกไว้ในระบบทันทีที่เลือกสินค้า
* **🧹 Cache Refresh (v2.04):** อัปเดต Service Worker Cache เป็น `sealthai-v2.04`

---

## 🚀 [v2.03] — 2026-09-14
### Clear Pending SO Breakdown in Inventory Posting List & Distinguish Pending vs Shipped Orders
* **📤 Pending SO Breakdown in Stock Ledger:** แยกรายการออเดอร์ที่ยังไม่จัดส่ง (`shipping_status = pending`) ออกจากออเดอร์ที่จัดส่งเรียบร้อยแล้วอย่างชัดเจน พร้อมติดป้าย `📤 รอจัดส่ง (SO)` สีแดงเด่นชัด ช่วยให้ตรวจสอบได้ทันทีว่าออเดอร์ใบไหน (เช่น `SO-...`) ที่ทำให้สินค้าติดยอดรอส่ง
* **🚀 Available Net Stock KPI Card:** เพิ่มการ์ดสรุปยอด `🚀 สต๊อกพร้อมขายสุทธิ` ในหน้าต่างประวัติสต๊อก (คำนวณจาก: สต๊อกจริงในคลัง + รอเข้าจาก PO - รอส่งมอบจาก SO)
* **🔍 Pending SO Filter:** เพิ่มตัวเลือก `📤 รอจัดส่งจาก SO (Pending Outbound)` ในตัวกรองประเภทธุรกรรมเพื่อเรียกดูเฉพาะรายการรอส่งได้ทันที
* **🧹 Cache Refresh (v2.03):** อัปเดต Service Worker Cache เป็น `sealthai-v2.03`

---

## 🚀 [v2.02] — 2026-09-14
### Strict Product Matcher & Fix Cross-Product Order Pollution
* **🛡️ Strict Product ID Matcher:** ปรับปรุงระบบจับคู่ประวัติธุรกรรมสต๊อก (Inventory Posting List) และยอดค้างส่ง (Pending SO) ให้ยึด `product_id` เป็นเกณฑ์หลัก 100% ป้องกันไม่ให้ออเดอร์ของสินค้าตัวอื่นที่มีขนาดมิติเดียวกัน (เช่น ซีล NBR ปกติ vs ซีล Viton) ดึงมาปะปนในประวัติของสินค้ารายการนี้
* **🔍 Exact Fallback Matching:** กรณีรายการที่ไม่มี `product_id` ระบบจะจับคู่เฉพาะชื่อสินค้า (`product_name`) และรหัส `SKU` ที่ตรงกันเป๊ะๆ เท่านั้น เพื่อความแม่นยำสูงสุด
* **🧹 Cache Refresh (v2.02):** อัปเดต Service Worker Cache เป็น `sealthai-v2.02`

---

## 🚀 [v2.01] — 2026-09-13
### Display Pending PO & Pending SO (Unshipped Orders) in Products Master Table & KPI Cards
* **📤 Pending SO Column in Products Table:** เพิ่มคอลัมน์ `📤 รอส่ง (SO)` ในตารางรายการสินค้าหลัก แสดงจำนวนสินค้าที่ลูกค้าเปิดออเดอร์สั่งซื้อแล้วแต่ยังรอจัดส่ง (`-จำนวน 📤` สีแดง) พร้อมคลิกเพื่อเปิดดูรายละเอียดใน Inventory Posting List ได้ทันที
* **⏳ Pending PO Column:** แสดงจำนวนสินค้าที่สั่งซื้อจาก Supplier ผ่าน PO แล้วและรอรับเข้าคลัง (`+จำนวน ⏳` สีอำพัน)
* **📊 5th Stat KPI Card — Pending SO:** เพิ่มการ์ดสถิติ `📤 รอจัดส่ง (SO)` ด้านบน แสดงยอดรวมสินค้าและจำนวนรายการที่รอส่ง พร้อมคลิกเพื่อกรองดูเฉพาะสินค้าที่ติดจอง/รอส่ง
* **📱 Mobile Product Cards:** แสดงทั้งยอดรอเข้า (PO) และยอดรอส่ง (SO) ในการ์ดสินค้าบนสมาร์ทโฟน
* **🧹 Cache Refresh (v2.01):** อัปเดต Service Worker Cache เป็น `sealthai-v2.01`

---

## 🚀 [v2.00] — 2026-09-13
### Open Reference Documents in New Window & Interactive Document Viewer
* **↗️ Open Documents in New Window (Popup / Tab ใหม่):** เมื่อคลิกที่เลขที่เอกสารอ้างอิง (เช่น `SO-20260906-0002` หรือ `PO-20260913-0002`) ในตารางประวัติสต๊อก (Inventory Posting List) ระบบจะเปิดเอกสารฉบับเต็ม (บิลเงินสด Cash Sale / ใบสั่งซื้อ Purchase Order A4) ในหน้าต่างใหม่ (`window.open` / New Tab) ทันที
* **✏️ Quick Modal Edit Button:** เพิ่มปุ่มดินสอ `✏️` เล็กๆ ข้างเลขที่เอกสาร สำหรับเปิดหน้าต่างแก้ไขข้อมูลในระบบโดยไม่รบกวนหน้าต่างหลัก
* **🧹 Cache Refresh (v2.00):** อัปเดต Service Worker Cache เป็น `sealthai-v2.00`

---

## 🚀 [v1.99] — 2026-09-13
### Smart Inventory Matcher & Multi-Layer Document Viewer Modal
* **🐛 Database Query Correction:** แก้ไขฟิลด์เรียกข้อมูลตาราง `purchase_order_items` ให้ตรงกับโครงสร้างฐานข้อมูล (ตัดฟิลด์ `qty` และ `purchase_price` ที่ไม่มีอยู่ออก) ทำให้ระบบดึงข้อมูล PO (เช่น `PO-20260913-0002`) และแสดงยอด `รอเข้าจาก PO (Pending)` ได้ครบถ้วน 100%
* **🔍 Precision Product Matcher:** เพิ่มระบบตรวจสอบจับคู่สินค้าอย่างละเอียด ป้องกันการดึงสลับขนาดมิติ (`20x30x7` vs `20x31x7`) หรือสลับวัสดุ (`Viton` vs `NBR`)
* **📑 Multi-Layer Document Viewer:** เมื่อคลิกที่เลขที่เอกสาร (`SO-...` หรือ `PO-...`) ในหน้า Inventory Posting List ระบบจะเปิดหน้าต่างรายละเอียดเอกสารซ้อนขึ้นมาทันที (Layered Modal) โดยไม่ต้องออกจากหน้าประวัติสต๊อก
* **🧹 Cache Refresh (v1.99):** อัปเดต Service Worker Cache เป็น `sealthai-v1.99`

---

## 🚀 [v1.98] — 2026-09-13
### Display Pending PO Quantities in Products Master Table, Mobile Cards & KPI Stats
* **⏳ Pending PO Column in Products Table:** เพิ่มคอลัมน์ `⏳ รอเข้า (PO)` ในตารางรายการสินค้าหลัก (Desktop Table) พร้อมป้ายเตือนสีอำพัน `+จำนวน ⏳` และสามารถคลิกเพื่อเปิดดูรายละเอียดประวัติการสั่งซื้อ (Inventory Posting List) ได้ทันที
* **📊 4th Stat KPI Card — Pending PO:** เพิ่มการ์ดสถิติ `⏳ รอรับเข้า (PO)` แสดงยอดรวมจำนวนชิ้นและจำนวนรายการสินค้าที่มี PO ค้างรับ พร้อมคลิกเพื่อกรองดูเฉพาะสินค้าที่มี PO รอเข้าได้ทันที
* **📱 Mobile Product Cards:** แสดงจำนวนที่รอเข้าจาก PO ในการ์ดสินค้าบนสมาร์ทโฟน
* **🔍 Sort & Filter by Pending PO:** รองรับการจัดเรียง (Sort) ตามจำนวน PO รอเข้า และตัวกรองสินค้าที่มี PO ค้างรับ
* **🧹 Cache Refresh (v1.98):** อัปเดต Service Worker Cache เป็น `sealthai-v1.98`

---

## 🚀 [v1.97] — 2026-09-13
### Universal PO Product Matcher & Pending Tracking for Inventory Posting List
* **🛒 Universal PO Matcher:** ปรับระบบดึงและจับคู่รายการจากใบสั่งซื้อ PO (เช่น `PO-20260913-0002`) เข้าสู่ประวัติสต๊อกของสินค้าทั้งทาง Product ID, รหัสขนาดมิติ (เช่น `20X31X7`), และชื่อสินค้าที่ถูกตัด Tag `[SO: ...]` ออกอย่างสมบูรณ์แบบ
* **⏳ Accurate Pending PO Display:** ดึงรายการค้างรับส่งมอบจาก PO แสดงในการ์ดสรุปยอดและตารางประวัติธุรกรรมสต๊อกได้ทันที 100%
* **🧹 Cache Refresh (v1.97):** อัปเดต Service Worker Cache เป็น `sealthai-v1.97`

---

## 🚀 [v1.96] — 2026-09-13
### Display Pending PO Quantities in Inventory Posting List & Stock Ledger
* **⏳ Pending PO Tracking in Inventory Posting:** แสดงรายการสินค้าที่สั่งซื้อผ่าน PO แต่ยังค้างส่งมอบ (Pending In-Transit) ในหน้า **Inventory Posting List** พร้อมระบุจำนวนที่สั่ง, จำนวนที่รับแล้ว, และยอดคงเหลือรอรับ
* **📊 5th KPI Card — Pending PO & Projected Stock:** เพิ่มการ์ดสรุปยอดสินค้าที่รอเข้าจาก PO พร้อมคำนวณยอดสต๊อกคงเหลือคาดการณ์สุทธิ (On-Hand + Pending PO)
* **🔍 Filter by Pending PO:** เพิ่มตัวเลือกในตัวกรอง `⏳ รอเข้าจาก PO (Pending In-Transit)` เพื่อดูเฉพาะรายการที่อยู่ระหว่างรอรับเข้า
* **🧹 Cache Refresh (v1.96):** อัปเดต Service Worker Cache เป็น `sealthai-v1.96`

---

## 🚀 [v1.95] — 2026-09-12
### Login Recovery & JavaScript Regex Syntax Repair
* **🐛 Critical Regex Syntax Repair:** แก้ไขไวยากรณ์ Regular Expression ในฟังก์ชัน `smartWildcardMatch` ให้ถูกต้องและโหลดบนเบราว์เซอร์ได้สมบูรณ์ 100%
* **🔐 Login Restoration:** กู้คืนปุ่มเข้าสู่ระบบ (`doLogin` และ `doDirectAdminLogin`) ให้ทำงานได้ทันที
* **🧹 Cache Refresh (v1.95):** อัปเดต Service Worker Cache เป็น `sealthai-v1.95` เพื่อบังคับล้างแคชและอัปเดตระบบ

---

## 🚀 [v1.94] — 2026-09-12
### Smart Wildcard & Flexible Dimension Search in Orders (*, -, x, space)
* **✨ Flexible Wildcard & Dimension Matching:** ค้นหาออเดอร์จากขนาดสินค้าด้วยสัญลักษณ์แทนได้อย่างอิสระ เช่น สินค้า `8x14x4` สามารถพิมพ์ค้นหาด้วย `8*14*4`, `8-14-4`, `8 14 4`, `8*4`, `TC*14*4` ได้อย่างแม่นยำ
* **🔍 Universal Search Support:** สลับตัวคั่นมิติอัตโนมัติ (สลับ `x`, `*`, `-`, `/`, เว้นวรรค) พร้อมรองรับ `*` (แทนข้อความใดๆ) และ `?` (แทน 1 ตัวอักษร)
* **🧹 Cache Refresh (v1.94):** อัปเดต Service Worker Cache เป็น `sealthai-v1.94`

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
