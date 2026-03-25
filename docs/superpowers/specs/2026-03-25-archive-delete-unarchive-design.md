# Archive: Delete & Unarchive PO

## Summary
เพิ่มปุ่ม "เอากลับ" (unarchive) และ "ลบถาวร" (permanent delete) ให้แต่ละ PO card ในหน้า Archive detail ใช้ได้เฉพาะ Admin เท่านั้น

## Context
- Archive ใช้ flag `is_archived = true` ใน table `po_list` (ไม่ใช่ table แยก)
- ชิ้นงานอยู่ใน `po_items` เชื่อมด้วย `po_number` (FK)
- ปัจจุบันไม่มีทางลบหรือเอา PO กลับจาก archive ได้

## UI Design

### ปุ่ม "⋯" (More menu)
- ตำแหน่ง: มุมขวาบนของ `.archive-po-card` header
- แสดงเฉพาะ `currentUser.role === 'admin'`
- กดแล้ว dropdown menu ลอยออกมาใต้ปุ่ม

### Dropdown menu
- 2 ตัวเลือกเรียงจากบนลงล่าง:
  1. `🔄 เอากลับ` — สีปกติ (text color)
  2. `🗑️ ลบถาวร` — สีแดง (#C62828) เพื่อเตือน
- Click outside dropdown → ปิด

### การทำงานทั้งใบ PO
- ทุก action ทำทั้งใบ PO (PO header + ชิ้นงานทั้งหมด)
- ไม่มีลบทีละชิ้นงาน

## Data Flow

### เอากลับ (Unarchive)
1. กด "⋯" → กด "🔄 เอากลับ"
2. `confirm("เอา PO-xxx กลับไปหน้าหลัก?")`
3. ยืนยัน → `UPDATE po_list SET is_archived = false, updated_at = NOW() WHERE id = ?`
4. `logActivity('unarchive', 'po', { po_number })`
5. `toast("✅ เอา PO-xxx กลับแล้ว")`
6. Reload archive detail view

### ลบถาวร (Permanent Delete)
1. กด "⋯" → กด "🗑️ ลบถาวร"
2. `confirm("ต้องการลบ PO-xxx ถาวร? ข้อมูลจะหายไปและกู้คืนไม่ได้")`
3. ยืนยัน → `DELETE FROM po_items WHERE po_number = ?` (ลบชิ้นงานก่อน — FK constraint)
4. → `DELETE FROM po_list WHERE id = ?`
5. `logActivity('delete_archived_po', 'po', { po_number, company, item_count })`
6. `toast("🗑️ ลบ PO-xxx ถาวรแล้ว")`
7. Reload archive detail view
8. ถ้า PO ในเดือนนั้นหมด → กลับไปหน้า archive home อัตโนมัติ

## Permissions
- ปุ่ม "⋯" แสดงเฉพาะ Admin
- Supervisor เห็น Archive ได้แต่ไม่มีปุ่ม ⋯

## Error Handling
| กรณี | พฤติกรรม |
|------|----------|
| Supabase error | toast แดง "❌ ไม่สำเร็จ: [error]" ข้อมูลไม่เปลี่ยน |
| PO ในเดือนนั้นหมดหลังลบ/เอากลับ | กลับหน้า archive home + reload |
| กด confirm แล้วกด "ยกเลิก" | ไม่ทำอะไร dropdown ปิด |
| กดนอก dropdown | dropdown ปิด |

## YAGNI — ไม่ทำ
- ไม่มี undo/soft delete
- ไม่มี batch select (เลือกหลายตัว)
- ไม่มีลบทีละชิ้นงาน

## Files to Modify
- `po-mobile.html` — เพิ่ม CSS + HTML + JS ในไฟล์เดียว

## Activity Log Format
```javascript
// Unarchive
await logActivity('unarchive', 'po', { po_number: 'PO-67-013' });
// Delete
await logActivity('delete_archived_po', 'po', { po_number: 'PO-67-013', company: 'AFR', item_count: 5 });
```
