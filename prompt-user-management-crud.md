# Prompt: เพิ่มปุ่ม CRUD ให้ User Management Panel ในหน้าจัดการ

## บริบท
ไฟล์: `po-mobile.html` — ตอนนี้หน้า "จัดการ" มีส่วน "👥 ผู้ใช้งานระบบ" แสดง user cards แล้ว (display_name, PIN, role badge, station) แต่ยังไม่มีปุ่มเพิ่ม/แก้ไข/ลบ

Backend: Supabase — table `users` มี columns: id (uuid), username, pin, role, station, display_name, is_active, created_at, updated_at

## สิ่งที่ต้องเพิ่ม (ห้ามแก้ส่วนที่ทำงานอยู่แล้ว)

### 1. ปุ่ม "+ เพิ่มผู้ใช้"
- วางไว้ข้างปุ่ม "🔄 รีเฟรช" ที่มีอยู่แล้ว
- กดแล้วแสดง form card ด้านบนสุดของ user list:
  - **ชื่อที่แสดง** (text input, required)
  - **Username** (text input, required, ภาษาอังกฤษ lowercase)
  - **PIN** (text input, maxlength=4, pattern="[0-9]{4}", required)
  - **Role** (dropdown: admin, supervisor, manager, staff)
  - **Station** (checkbox group):
    - ☐ ทุกจุด (all)
    - ☐ จุดรับของ (receiving)
    - ☐ ผลิต (production)
    - ☐ QC (qc)
    - ☐ จุดส่งของ (shipping)
    - Logic: ถ้าเลือก "ทุกจุด" → ยกเลิกตัวอื่น / ถ้าเลือกตัวอื่น → ยกเลิก "ทุกจุด"
- ปุ่ม "✅ บันทึก" และ "❌ ยกเลิก"
- บันทึก → INSERT into Supabase `users`
- เสร็จแล้ว → reload user list + toast สำเร็จ

### 2. ปุ่ม "✏️" (แก้ไข) ในแต่ละ user card
- วางมุมขวาบนของ card
- กดแล้ว card เปลี่ยนเป็น edit mode:
  - ชื่อที่แสดง → text input (pre-filled)
  - Username → text input (pre-filled)
  - PIN → text input (pre-filled, เห็นเลข)
  - Role → dropdown (pre-selected)
  - Station → checkbox group (pre-checked)
- ปุ่ม "✅ บันทึก" → UPDATE Supabase → reload list
- ปุ่ม "❌ ยกเลิก" → กลับ view mode (ไม่ reload)

### 3. ปุ่ม "🗑️" (ลบ) ในแต่ละ user card
- วางข้าง ✏️
- **ห้ามแสดงปุ่มลบ** ถ้า user นั้นคือ currentUser (ห้ามลบตัวเอง)
- กด → confirm("ต้องการลบ [display_name] จริงหรือไม่?")
- ยืนยัน → DELETE from Supabase `users` WHERE id = ... → reload list
- ยกเลิก → ไม่ทำอะไร

### 4. Validation (ทั้ง Add และ Edit)
- Display Name ห้ามว่าง
- Username ห้ามว่าง + ห้ามซ้ำกับ user อื่น (query Supabase เช็ค)
- PIN ต้องเป็นตัวเลข 4 หลัก + ห้ามซ้ำกับ user อื่น (query Supabase เช็ค)
- Station ต้องเลือกอย่างน้อย 1 อัน
- ถ้า validation ไม่ผ่าน → แสดง toast แดง บอกว่าผิดตรงไหน

### 5. Activity Log
ทุกการเพิ่ม/แก้ไข/ลบ ต้องเรียก `logActivity()` ที่มีอยู่แล้ว:
```javascript
// เพิ่ม
await logActivity('add_user', 'user', { username, display_name, role, station });
// แก้ไข
await logActivity('edit_user', 'user', { username, changes: { field: 'old→new', ... } });
// ลบ
await logActivity('delete_user', 'user', { username, display_name });
```

### 6. PIN Toggle (ปรับปรุง)
- PIN ที่แสดงอยู่ตอนนี้เห็นเลขตรงๆ → เปลี่ยนเป็น `••••` เป็น default
- เพิ่มปุ่ม 👁 เล็กๆ ข้าง PIN → กดเพื่อ toggle แสดง/ซ่อน PIN
- เฉพาะ Admin เห็น PIN ได้ (ซึ่ง section นี้ Admin เท่านั้นเห็นอยู่แล้ว)

## ⚠️ กฎสำคัญ
- **ห้ามแก้ logic/feature อื่นๆ** ที่ไม่เกี่ยว — เช่น QC, PO, Archive, Dashboard
- **ห้ามเปลี่ยน CSS เดิมที่ทำงานอยู่แล้ว** — เพิ่มได้เท่านั้น
- **ห้ามลบ code เดิม**
- ใช้ Supabase client `sb` (global variable ที่มีอยู่แล้ว)
- ใช้ `toast()` function ที่มีอยู่แล้ว
- ใช้ `logActivity()` function ที่มีอยู่แล้ว
- Station เก็บเป็น comma-separated string ใน Supabase เช่น "receiving,shipping" หรือ "all"
- ทำ responsive mobile-first — ปุ่มต้องกดง่ายบนมือถือ

## หลังเสร็จ:
```
git add po-mobile.html
git commit -m "feat: add CRUD buttons for user management (add/edit/delete users)"
git push origin main
```
