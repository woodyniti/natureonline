# SEALTHAI System Roadmap

เอกสารแนวทางพัฒนาระบบเพื่อเพิ่มประสิทธิภาพงานขาย งานบัญชี การวางแผนสต๊อก และการนำเข้าสินค้าจากจีน สำหรับการเติบโตเป็นร้านจำหน่ายอะไหล่และซีล

> จัดทำจากการประเมินระบบ SEALTHAI และใช้คำว่า **Stock Planning** ในความหมายของการวางแผนสต๊อก

## สรุปภาพรวม

ระบบมีพื้นฐานงานซื้อ ขาย รับเงิน จ่ายเงิน และสต๊อกค่อนข้างครบแล้ว แต่ยังต้องเสริมระบบช่วยตัดสินใจและระบบควบคุม เพื่อให้ตอบคำถามสำคัญได้ว่า:

- ควรซื้อสินค้าอะไร จำนวนเท่าไร และเมื่อไร
- ต้นทุนจริงหลังนำเข้าเป็นเท่าไร
- สินค้าตัวใดทำกำไรหรือทำให้เงินจม
- ลูกค้ารายใดควรติดตามและเสนอขายอะไรเพิ่ม
- ยอดในระบบตรงกับบัญชี ธนาคาร และสต๊อกจริงหรือไม่

## 1. Product Master สำหรับอะไหล่และซีล

ข้อมูลสินค้าควรรองรับ:

- Part Number, OEM Number, SKU และ Supplier Code
- ขนาด ID × OD × Width
- วัสดุ NBR, FKM/Viton, PU และ PTFE
- รูปแบบปากซีล สปริง อุณหภูมิ แรงดัน และความเร็วรอบ
- ยี่ห้อ เครื่องจักร รุ่น และตำแหน่งที่ใช้งาน
- สินค้าทดแทนและ Cross-reference
- น้ำหนัก ขนาดบรรจุ และจำนวนต่อกล่อง
- HS Code, รูปสินค้า และ Drawing

ระบบค้นหาควรค้นได้จากขนาด เบอร์เดิม OEM รุ่นเครื่อง และแสดงสินค้าทดแทนหลายระดับราคา

## 2. Stock Planning

ควรเพิ่มข้อมูลและการคำนวณดังนี้:

- Lead Time ของ Supplier
- MOQ และ Pack Size
- Safety Stock และ Reorder Point
- Available, Reserved และ In-transit Stock
- ยอดขายเฉลี่ย 30/90/180 วัน
- Days of Stock และ Stockout Risk
- ABC Analysis
- Fast-moving, Slow-moving และ Dead Stock
- ระบบเสนอจำนวนสั่งซื้อและสร้าง PO

สูตรตั้งต้น:

```text
Suggested Order Qty
= Forecast Demand During Lead Time
+ Safety Stock
- Available Stock
- In-transit Stock
```

## 3. China Import และ Landed Cost

ควรมีทะเบียน Shipment ตั้งแต่ต้นจนรับเข้าคลัง:

- RFQ, Sample, Proforma Invoice และ Purchase Order
- Supplier, MOQ, Currency และ Exchange Rate
- Incoterms เช่น EXW, FOB และ CIF
- เงินมัดจำ ยอดคงเหลือ วันผลิตเสร็จ และ ETA
- ค่าขนส่งจีน ค่าขนส่งระหว่างประเทศ และประกันภัย
- อากรนำเข้า VAT นำเข้า ค่าชิปปิ้ง และค่าขนส่งในไทย
- HS Code, Form E/RCEP และเอกสารแนบ
- ปันส่วน Landed Cost ตามมูลค่า น้ำหนัก CBM หรือจำนวน
- เปรียบเทียบต้นทุนประมาณการกับต้นทุนจริง
- รับสินค้าเข้าคลังและอัปเดตต้นทุนจริงแยกตามล็อต

อัตราอากรและสิทธิประโยชน์ต้องตรวจตาม HS Code ถิ่นกำเนิดสินค้า และเงื่อนไขของเอกสารแต่ละ Shipment

แหล่งอ้างอิง:

- [กรมศุลกากร: ราคาศุลกากร](https://www.customs.go.th/content.php?ini_content=customs_valuation_01&ini_menu=menu_customs_value&lang=th&left_menu=menu_customs_value&xleft_menu=menu_customs_value_01)
- [กรมศุลกากร: Form E สำหรับการนำเข้าจากจีน](https://www.customs.go.th/cont_strc_faq.php?current_id=14232a32404e505f4c464b4a464b47&ini_menu=&lang=th&left_menu=menu_center_004&top_menu=menu_homepage)

## 4. Accounting Core

ระบบบัญชีเต็มรูปแบบควรประกอบด้วย:

- Chart of Accounts
- Double-entry Journal และ General Ledger
- ลงบัญชีอัตโนมัติจาก SO, AR Invoice, Receipt, CN, PO, GR และ AP Invoice
- ต้นทุนขายและมูลค่าสินค้าคงเหลือ
- Bank Reconciliation
- AR/AP Aging
- ภาษีซื้อ ภาษีขาย และภาษีหัก ณ ที่จ่าย
- Trial Balance, Profit and Loss, Balance Sheet และ Cash Flow
- Period Closing และการล็อกงวด
- Audit Log
- 3-Way Match ระหว่าง PO, Goods Receipt และ AP Invoice

ควรให้นักบัญชีตรวจผังบัญชี การลงรายการ และรายงานภาษีก่อนนำไปใช้ออกงบจริง

## 5. CRM และการเพิ่มยอดขาย

- Customer Master และประวัติการซื้อ
- แบ่งกลุ่มลูกค้า B2C, ช่าง/อู่, ร้านค้าส่ง และโรงงาน
- ราคาหลายระดับและ Volume Discount
- เครดิตเทอมและวงเงินเครดิต
- Quotation Pipeline และการเตือนติดตาม
- แจ้งเตือนรอบซื้อซ้ำ
- สินค้าทดแทน Cross-sell และขายเป็นชุด
- Margin Guardrail ป้องกันการขายต่ำกว่ากำไรขั้นต่ำ
- วิเคราะห์กำไรตามลูกค้า SKU และช่องทาง
- รวมคำสั่งซื้อและสต๊อกจาก Marketplace

## 6. Warehouse Control

- คลัง ชั้น และช่องจัดเก็บสินค้า
- Barcode หรือ QR Code
- Lot/Batch และต้นทุนแยกล็อต
- Receiving QC
- Stock Transfer
- Cycle Count
- Stock Adjustment พร้อมการอนุมัติ
- สินค้าคืน: ขายต่อได้ เสียหาย หรือส่งคืน Supplier

## 7. Supplier Management

Supplier Scorecard ควรเปรียบเทียบ:

- ราคาซื้อและเงื่อนไขชำระเงิน
- MOQ และ Lead Time จริง
- การส่งครบและตรงเวลา
- อัตราของเสียและการรับประกัน
- ค่าเงินและ Landed Cost
- Supplier จีนเทียบกับ Supplier ไทย

## KPI ที่แนะนำ

### KPI หลัก

1. กำไรขั้นต้นหลังหักต้นทุนจริงทุกช่องทาง
2. เงินสดที่ติดอยู่ในสต๊อก
3. อัตราสินค้าพร้อมขายเมื่อมีคำสั่งซื้อ

### KPI สนับสนุน

- Inventory Turnover และ Days of Stock
- Stockout Rate และ Dead Stock
- Gross Margin ตาม SKU ลูกค้า และช่องทาง
- Quote-to-Order Conversion และ Repeat Purchase Rate
- Supplier On-time In-full
- Landed Cost Estimate Variance
- AR Overdue และ AP Due

## Roadmap รุ่นแนะนำ

| Version | ขอบเขต |
|---|---|
| v1.34 | Product Master & Stock Planning |
| v1.35 | China Import & Landed Cost |
| v1.36 | Marketplace Integration |
| v1.37 | CRM, B2B Pricing & Credit Control |
| v1.38 | Executive Analytics & Cash Flow Forecasting |
| รุ่นถัดไป | Warehouse Barcode, Accounting Core และ Supplier Scorecard |

## ลำดับความสำคัญ

ก่อนเพิ่มการนำเข้าจากจีน ควรทำให้ระบบมีข้อมูล 5 รายการนี้ครบก่อน:

1. ยอดขายย้อนหลังราย SKU
2. Lead Time และความผันผวนของ Supplier
3. Landed Cost จริงต่อหน่วย
4. MOQ และเงินสดที่ต้องใช้
5. Days of Stock และความเสี่ยง Dead Stock

การซื้อจากจีนจะลดต้นทุนได้จริงต่อเมื่อส่วนต่างกำไรหลังรวม Landed Cost มากพอ และสินค้าเคลื่อนไหวเร็วพอที่จะไม่ทำให้เงินทุนจมในสต๊อก
