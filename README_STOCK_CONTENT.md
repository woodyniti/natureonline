# Content Studio: โพสต์สินค้าในสต๊อกอัตโนมัติ

สถานะ: โค้ดพร้อมติดตั้ง แต่ **ยังไม่เริ่มโพสต์** จนกว่าจะติดตั้ง PHP บนเว็บและกำหนดค่าลับบนเซิร์ฟเวอร์ทั้งสองฝั่ง

## การทำงาน

- ทุก 1 ชั่วโมงเลือก 1 SKU ที่มี `stock_qty > 0` จากร้านใน `DEFAULT_SHOP_ID`
- เลือก SKU ที่ยังไม่เคยลงก่อน; เมื่อครบจึงเริ่มรอบใหม่โดยใช้มุมเนื้อหาต่างจากรอบก่อน
- 1 SKU มี 1 URL คงที่ใต้ `/article/stock/` และรอบถัดไป **อัปเดตหน้าเดิม** ไม่สร้างหน้า SEO ซ้ำ
- ข้อความอ้างอิงจากชื่อ, SKU, รายละเอียด, สเปก, ราคา และสต๊อกในฐานข้อมูลเท่านั้น ไม่เดาคุณสมบัติทางเทคนิค
- หน้าที่มีเพียงชื่อ/รหัสแต่ขาดคำอธิบายและสเปกที่เพียงพอจะใส่ `noindex,follow` ชั่วคราว เพื่อไม่สร้างหน้าเนื้อหาบางจำนวนมากในผลค้นหา
- เมื่อ PHP ยืนยัน URL แล้วจึงบันทึกประวัติและส่ง Telegram พร้อมข้อความ Facebook ให้คัดลอก (ไม่โพสต์ลง Facebook อัตโนมัติ)
- หากเผยแพร่ผิดพลาด จะไม่ข้าม SKU; รอ 15 นาทีแล้วลองใหม่ ข้อความผิดพลาดอยู่ใน log

## ติดตั้งฝั่งเว็บไซต์ PHP/HTML

1. อัปโหลด `api-stock-content.php` ไปที่ document root ของ `sealthai.com` (ตำแหน่งเดียวกับหน้าเว็บหลัก)
2. ตั้งค่า environment variable `STOCK_CONTENT_PUBLISH_TOKEN` เป็นค่าสุ่มยาวอย่างน้อย 32 ตัวอักษรในระบบโฮสติ้ง PHP **ห้ามใส่ในไฟล์หรือ GitHub**
3. ให้ PHP เขียนโฟลเดอร์ `article/stock/` ได้; สคริปต์จะสร้าง `index.html`, `index.json` และหน้า SKU เอง
4. ถ้า URL สาธารณะต้องใช้ `https://sealthai.com` แทน `https://www.sealthai.com` ให้ตั้ง `STOCK_CONTENT_PUBLIC_BASE_URL` ใน PHP environment ให้ตรงกัน
5. หากต้องการให้เห็นจากหน้าบทความหลัก ให้เพิ่มลิงก์ไปยัง `/article/stock/` ในเมนูของเว็บเดิม (ไฟล์หน้าเว็บหลักไม่ได้อยู่ในรีโปนี้)

## ตั้งค่าฝั่ง Node.js 24/7

ใช้ค่า token **เดียวกัน** กับฝั่ง PHP และกำหนดใน environment ของโปรเซส Node.js:

```env
STOCK_CONTENT_ENABLED=true
STOCK_CONTENT_PUBLISH_URL=https://www.sealthai.com/api-stock-content.php
STOCK_CONTENT_PUBLISH_TOKEN=<secret from secure server configuration>
DEFAULT_SHOP_ID=<shop UUID>
SUPABASE_URL=<Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_ADMIN_CHAT_ID=<chat ID>
```

จากนั้น deploy ไฟล์ Node.js ที่อัปเดตและ restart `sealthai_ai_bot_server.js` บนเซิร์ฟเวอร์ ควรรัน worker เพียง **1 instance** ต่อฐาน SQLite เดียวกันเพื่อไม่ให้เลือก SKU ซ้ำในชั่วโมงเดียวกัน

## ตรวจสอบ

1. ฝั่ง Node log ต้องขึ้น `[Stock Content] Published SKU...` ไม่ใช่ `Disabled` หรือ `Not started`
2. เปิด URL ที่ Telegram ส่งมา ต้องเป็นหน้าเว็บจริงและแสดงข้อมูล SKU ถูกต้อง
3. เปิด `https://www.sealthai.com/article/stock/` เพื่อดูรายการที่เผยแพร่
4. หลังครบทุก SKU ตรวจว่ารอบใหม่อัปเดต **URL เดิม** และข้อความ Facebook เปลี่ยนมุมเนื้อหา
5. หากไม่มี Telegram แต่หน้าเว็บมีบทความ ให้ดู log `Published but Telegram failed` และตรวจ bot/chat ID

> โทเคนตัวเผยแพร่บทความเดิมใน `sealthai_ai_bot_server.js` ถูกเขียนไว้ใน source code มาก่อน ควรเปลี่ยนโทเคนนั้นที่เซิร์ฟเวอร์เดิมแยกต่างหาก และไม่ใช้ซ้ำกับโทเคนใหม่
