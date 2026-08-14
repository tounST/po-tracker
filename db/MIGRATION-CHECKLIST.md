# ตรวจทุกครั้งหลังแก้ DB function

1. **เพิ่ม/ลบพารามิเตอร์ = DROP แล้ว CREATE** — `CREATE OR REPLACE` แทนที่เฉพาะ
   signature ที่ตรงเป๊ะ เพิ่มพารามิเตอร์แล้ว REPLACE จะได้ฟังก์ชันตัวที่ 2 ซ้อนขึ้นมา

2. **ยืนยันว่าเหลือแถวเดียว:**
   ```sql
   select oid::regprocedure, pronargs from pg_proc
    where proname = '<ชื่อฟังก์ชัน>' and pronamespace = 'public'::regnamespace;
   ```
   ถ้าได้เกิน 1 แถว และทั้งคู่รับ named args ชุดเดียวกันได้ → PostgREST ตอบ
   **PGRST203 "could not choose the best candidate function"** ทุกการเรียก
   (ของใหม่และของเก่าล้มพร้อมกัน)

3. **ยิงจริงทั้งสองรูปแบบที่ client ใช้** — ทั้งแบบที่ปุ่มบนหน้าจอส่ง และแบบที่
   import ส่ง บนวัสดุทดสอบชั่วคราว แล้วลบทิ้ง

4. **ตรวจว่าข้อมูลจริงกลับมาเท่าเดิม** ก่อนจบงาน

> ชุดทดสอบ UI จับข้อ 2 ไม่ได้ เพราะ shim resolve `rpc()` ด้วยชื่ออย่างเดียว
> — overload resolution มีเฉพาะใน PostgREST จริงเท่านั้น (BUG46)
