-- 2026-09-28 — สิทธิ์ "ลบวัสดุ" (stockDeleteItem) เฉพาะ admin
--
-- toun: หาปุ่มลบวัสดุไม่เจอ · ให้สร้างปุ่มลบบนหน้าคลัง แต่เปิดสิทธิ์เฉพาะแอดมิน
-- ปุ่มเดิมคุมด้วย manageDataDelete ซึ่งเปิดให้ supervisor/office ด้วย → แยกธงใหม่
--
-- role_permissions ไม่มี CHECK บน permission_key → ไม่ต้อง migrate schema
-- (admin ไม่ต้องใส่แถว — code ล็อก admin ไว้ที่ค่า default และ loader ข้ามแถว admin)
-- เปิดให้ role อื่นได้ที่ stock.html แท็บ 🔐 ผู้ดูแล → "ลบวัสดุ"

INSERT INTO role_permissions (role, permission_key, allowed, updated_at, updated_by)
VALUES
  ('supervisor', 'stockDeleteItem', false, now(), 'migration 2026-09-28'),
  ('office',     'stockDeleteItem', false, now(), 'migration 2026-09-28'),
  ('manager',    'stockDeleteItem', false, now(), 'migration 2026-09-28'),
  ('staff',      'stockDeleteItem', false, now(), 'migration 2026-09-28')
ON CONFLICT (role, permission_key) DO NOTHING;
