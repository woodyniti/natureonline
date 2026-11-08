# SEALTHAI v3.29 — User + พนักงาน

## ติดตั้งก่อนใช้งาน

1. สำรองฐานข้อมูล Supabase และยืนยันว่าบัญชี Owner เข้าด้วย Supabase Auth ได้จริง
2. เปิด Supabase SQL Editor และรัน `supabase_employee_user_link_v329.sql` หนึ่งครั้ง
3. Deploy Edge Function `supabase/functions/manage-member/index.ts` ชื่อ `manage-member` ในโปรเจกต์ Supabase เดิม โดยเปิดการตรวจ JWT และตั้ง `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` **เฉพาะฝั่ง Supabase Function** ห้ามใส่ service-role key ใน `index.html`
4. ทดสอบ Owner Login → จัดการ User → สร้างบัญชีทดสอบ → ผูกพนักงานเดิม → Login ด้วยบัญชีทดสอบ → แก้ไขสิทธิ์ → ปิดบัญชีทดสอบ

ถ้า Function ยังไม่ deploy ปุ่มสร้าง/แก้ User จะแจ้งข้อผิดพลาดและไม่สร้างบัญชีค้างครึ่งทาง ส่วนการผูกพนักงานไม่จับคู่จากชื่ออัตโนมัติ เพราะชื่ออาจซ้ำกัน

## ข้อควรระวังด้านความปลอดภัย

Migration นี้ปิดการอ่านแบบ anonymous เฉพาะ `shop_members` และ `employees` และย้ายการแก้ `shop_members` ไปที่ Function เท่านั้น ตารางธุรกิจอื่นจำนวนมากยังใช้สิทธิ์เดิมจาก `supabase_unlock_all_tables_permissions.sql` จึง **ยังไม่ถือว่าทั้งระบบปลอดภัย** ต้องตรวจและทำ RLS รายตารางก่อนเปิดให้ผู้ใช้ภายนอกหรือข้อมูลหลายร้านใช้ร่วมกัน ห้ามรันสคริปต์ unlock ดังกล่าวซ้ำหลัง migration นี้

บัญชี Owner ที่มีอยู่ไม่ได้ถูกสร้างใหม่หรือเปลี่ยนรหัสผ่าน การเปิดสิทธิ์ให้พนักงานเดิมต้องเลือกชื่อในหน้าจัดการ User เอง
