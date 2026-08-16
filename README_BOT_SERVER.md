# 🤖 คู่มือการติดตั้งและใช้งาน SEALTHAI AI Bot Server (LINE OA & Telegram)

เซิร์ฟเวอร์ Node.js สำหรับตอบลูกค้าบน LINE OA `@sealthai` อัตโนมัติ พร้อมส่งแจ้งเตือนขออนุมัติสินค้าทดแทนเข้า Telegram Admin

---

## ⚙️ 1. การตั้งค่า Environment Variables (`.env`)

สร้างไฟล์ `.env` ในโฟลเดอร์โปรเจกต์:

```env
PORT=3000

# Supabase Credentials
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# LINE Messaging API Credentials
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret

# Telegram Bot Credentials
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-admin-chat-id
```

---

## 🚀 2. การติดตั้งและเริ่มรันเซิร์ฟเวอร์

```bash
# 1. ติดตั้ง Dependencies
npm install express axios dotenv @supabase/supabase-js

# 2. รันเซิร์ฟเวอร์
node sealthai_ai_bot_server.js

# หรือรันผ่าน PM2 บนเซิร์ฟเวอร์ VPS
pm2 start sealthai_ai_bot_server.js --name "sealthai-ai-bot"
```

---

## 🔗 3. การผูก Webhook URL

1. **LINE Developers Console:**
   * ตั้ง Webhook URL เป็น: `https://your-domain.com/webhook/line`
   * เปิดสวิตช์ **Use Webhook**
2. **Telegram Bot Webhook:**
   * รันคำสั่งผูก Webhook:
     ```bash
     curl -F "url=https://your-domain.com/webhook/telegram" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
     ```

---

## 🧪 4. การทำงานของระบบ
1. **เมื่อลูกค้าทัก LINE OA:**
   * ลูกค้าถามขนาด เช่น *"ขอราคาโอริง 14x2.5 10 ตัว"* $\rightarrow$ บอทเช็คสต็อกและตอบราคาทันที
   * ลูกค้าถามขนาดเทียบ เช่น *"มี 90x5.50 ไหม"* $\rightarrow$ บอทแจ้งลูกค้าให้รอสักครู่ + ส่งปุ่มกดอนุมัติเข้า Telegram Admin
2. **เมื่อ Admin กดอนุมัติผ่าน Telegram:**
   * ระบบบันทึกเข้าตาราง `approved_substitutes` ทันที ครั้งถัดไปบอทจะเสนอขายอัตโนมัติ
3. **การสร้างใบเสนอราคาด่วนบน Dashboard:**
   * Admin Copy ข้อความแชตจากลูกค้า $\rightarrow$ วางใน **"🤖 AI ดึงใบเสนอราคาจากแชต (Fast Quote)"** บนหน้าเว็บ $\rightarrow$ กด **"📄 บันทึกเป็น Draft ใบเสนอราคา"** ได้ทันทีใน 10 วินาที
