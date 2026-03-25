# Prompt: เพิ่ม User Management Panel ในหน้าจัดการ (Settings)

## บริบท
ไฟล์: `po-mobile.html` (single-file PWA)
Backend: Supabase — table `users` มี columns: id (uuid), username, pin, role, station, display_name, created_at, updated_at

### ข้อมูล users ปัจจุบันใน Supabase:
| username | PIN | role | station | display_name |
|---|---|---|---|---|
| toun | 1122 | admin | all | Toun (Admin) |
| supervisor | 2233 | supervisor | all | หัวหน้างาน |
| manager | 4444 | manager | receiving,shipping | ผู้จัดการ |
| production | 1111 | staff | production | พนักงานผลิต |
| qc | 2222 | staff | qc | QC |
| delivery | 0000 | staff | receiving,shipping | พนักงานส่ง/รับของ |

## สิ่งที่ต้องทำ

### 1. เพิ่มส่วน "👥 จัดการผู้ใช้" ในหน้า Settings (page-settings)
- เฉพาะ Admin เท่านั้นที่เห็น section นี้ (ใช้ `hasPermission('manage_users')` หรือ `currentUser.role === 'admin'`)
- วางไว้ **ด้านบนสุด** ของหน้า Settings ก่อนส่วนจัดการ dropdown อื่นๆ

### 2. แสดงตารางผู้ใช้ทั้งหมด
แสดงเป็น card list (mobile-friendly ไม่ใช่ table) แต่ละ user card แสดง:
- **ชื่อแสดง** (display_name) ตัวใหญ่
- **Username** สีเทาเล็กๆ
- **PIN** แสดงเป็น `••••` แต่มีปุ่ม 👁 กดเพื่อเปิดดู PIN จริง (toggle)
- **Role badge** มีสี:
  - 👑 Admin = สีม่วง
  - 📋 Supervisor = สีน้ำเงิน
  - 🏢 Manager = สีเขียว
  - 👤 Staff = สีเทา
- **Station labels** แสดงเป็น tag เล็กๆ:
  - 📥 จุดรับของ (receiving)
  - 🔄 ผลิต (production)
  - 🔍 QC (qc)
  - 📦 จุดส่งของ (shipping)
  - 🌐 ทุกจุด (all)

### 3. ปุ่มเพิ่มผู้ใช้ใหม่
- ปุ่ม "+ เพิ่มผู้ใช้" ด้านบน
- กดแล้วแสดง form ใน card:
  - Display Name (text input)
  - Username (text input)
  - PIN (4 หลัก, number input, maxlength=4)
  - Role (dropdown: admin, supervisor, manager, staff)
  - Station (multi-select checkbox: receiving, production, qc, shipping, all)
    - ถ้าเลือก "all" → ยกเลิกตัวอื่นทั้งหมด
    - ถ้าเลือกตัวอื่น → ยกเลิก "all"
- ปุ่ม "บันทึก" → INSERT into Supabase `users` table
- ปุ่ม "ยกเลิก" → ซ่อน form

### 4. แก้ไขผู้ใช้
- แต่ละ user card มีปุ่ม "✏️ แก้ไข"
- กดแล้ว card เปลี่ยนเป็น edit mode (fields กลายเป็น input)
- แก้ได้ทุกอย่างยกเว้น id
- ปุ่ม "บันทึก" → UPDATE Supabase
- ปุ่ม "ยกเลิก" → กลับ view mode

### 5. ลบผู้ใช้
- แต่ละ user card มีปุ่ม "🗑️ ลบ" (ยกเว้น admin ตัวเอง — ห้ามลบ)
- กด → confirm dialog "ต้องการลบ [display_name] จริงหรือไม่?"
- ยืนยัน → DELETE from Supabase
- **ห้ามลบ user ที่กำลัง login อยู่** (currentUser)

### 6. Activity Log
- ทุกการเพิ่ม/แก้ไข/ลบ user ต้อง logActivity:
  - `logActivity('add_user', 'user', { username, role, station })`
  - `logActivity('edit_user', 'user', { username, changes: {...} })`
  - `logActivity('delete_user', 'user', { username, display_name })`

### 7. Validation
- PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น
- PIN ห้ามซ้ำกับ user อื่น (เช็คก่อน save)
- Username ห้ามซ้ำ
- Display Name ห้ามว่าง

## ⚠️ กฎสำคัญ
- **ห้ามแก้ logic/feature อื่นๆ** ที่ไม่เกี่ยวกับ User Management
- **ห้ามเปลี่ยน CSS ที่มีอยู่แล้ว** — เพิ่มได้อย่างเดียว
- **ห้ามลบ code เดิมที่ทำงานปกติ**
- ใช้ Supabase client `sb` ที่มีอยู่แล้วในไฟล์ (global variable)
- ใช้ `toast()` function ที่มีอยู่แล้วสำหรับแสดงข้อความ
- ใช้ `logActivity()` function ที่มีอยู่แล้ว
- เพิ่ม CSS ใหม่ใน `<style>` block ที่มีอยู่
- ทำ responsive — ใช้งานบนมือถือเป็นหลัก
- สไตล์ให้เข้ากับ UI ปัจจุบัน (modern clean, rounded corners, shadows)

## ตัวอย่าง Layout ที่ต้องการ

```
┌─────────────────────────────┐
│ 👥 จัดการผู้ใช้              │
│ [+ เพิ่มผู้ใช้]              │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Toun (Admin)      ✏️ 🗑️│ │
│ │ @toun                   │ │
│ │ PIN: ••••  👁           │ │
│ │ 👑 Admin  🌐 ทุกจุด    │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ หัวหน้างาน        ✏️ 🗑️│ │
│ │ @supervisor             │ │
│ │ PIN: ••••  👁           │ │
│ │ 📋 Supervisor 🌐 ทุกจุด│ │
│ └─────────────────────────┘ │
│ ...                         │
└─────────────────────────────┘
```

## หลัง commit แล้ว push ด้วย:
```
git add po-mobile.html
git commit -m "feat: add user management panel in settings for admin"
git push origin main
```
