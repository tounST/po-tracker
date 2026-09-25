-- 2026-09-25 — แยกสิทธิ์ "เข้าคลังสต๊อก" (viewStock) ออกจาก "เข้าหน้า ERP" (viewERP)
--
-- toun: ERP ใช้ได้เฉพาะ admin / supervisor / office · พนักงานทั่วไปเข้าหน้าสต๊อก
-- ตรงจากปุ่มในหน้า PO ไม่ต้องผ่าน ERP.
--
-- เดิม stock.html เช็ค viewERP → staff ที่ได้ stockIn/stockOut แล้วก็ยังเปิดหน้าสต๊อก
-- ไม่ได้เลย. ตอนนี้ stock.html เช็ค viewStock แทน ส่วน viewERP ใช้แค่ตัดสินว่า
-- ปุ่มย้อนกลับพาไป ERP หรือ PO.
--
-- role_permissions ไม่มี CHECK บน permission_key → ไม่ต้อง migrate schema
-- (admin ไม่ต้องใส่แถว — code ล็อก admin ไว้ที่ค่า default และ loader ข้ามแถว admin)

INSERT INTO role_permissions (role, permission_key, allowed, updated_at, updated_by)
VALUES
  ('supervisor', 'viewStock', true, now(), 'migration 2026-09-25'),
  ('office',     'viewStock', true, now(), 'migration 2026-09-25'),
  ('manager',    'viewStock', true, now(), 'migration 2026-09-25'),
  ('staff',      'viewStock', true, now(), 'migration 2026-09-25')
ON CONFLICT (role, permission_key) DO UPDATE
  SET allowed = EXCLUDED.allowed, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;

-- manager ไม่อยู่ในรายชื่อที่ toun ให้ใช้ ERP → เข้าสต๊อกตรงแบบพนักงานแทน
-- (เปิดกลับได้เองที่ stock.html แท็บ 🔐 ผู้ดูแล → Manager → "เข้าหน้า ERP")
UPDATE role_permissions
   SET allowed = false, updated_at = now(), updated_by = 'migration 2026-09-25'
 WHERE role = 'manager' AND permission_key = 'viewERP';
