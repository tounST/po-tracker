-- 2026-09-26 — หน่วยของวัสดุเป็นรายการที่จัดการได้ + ปุ่ม "เพิ่มหน่วย" แบบมีสิทธิ์
-- toun: เพิ่มวัสดุใหม่ ๆ มักมีหน่วยใหม่มาด้วย ต้องเพิ่มผ่านปุ่ม
--       ปุ่มให้เฉพาะ admin / supervisor / office · เปิดปิดสิทธิ์ได้ · คนอื่นไม่เห็นปุ่ม
--
-- เก็บใน config (ที่เดียวกับ company/car_model/part_name) → ต้องขยาย CHECK ก่อน
-- (บทเรียน BUG17/19/31 — ค่า enum-like ใหม่ต้อง migrate constraint เสมอ)
-- หน้า PO กรอง config ตาม type ของตัวเองอยู่แล้ว แถว stock_unit จึงไม่ไปโผล่ที่นั่น
-- migration name ใน Supabase: stock_units_in_config

ALTER TABLE public.config DROP CONSTRAINT config_config_type_check;
ALTER TABLE public.config ADD CONSTRAINT config_config_type_check
  CHECK (config_type = ANY (ARRAY['company','car_model','part_name','defect_reason','stock_unit']));

-- seed: 9 หน่วยที่ฟอร์มเคยเสนอ + ทุกหน่วยที่วัสดุใช้อยู่ (ตอนนั้นอยู่ในชุด 9 อยู่แล้วทั้งหมด)
INSERT INTO public.config (config_type, config_value, sort_order)
SELECT 'stock_unit', u, row_number() OVER (ORDER BY ord, u)
FROM (
  SELECT u, min(ord) AS ord FROM (
    SELECT unnest(ARRAY['กก.','กิโลกรัม','ลิตร','ชุด','แผ่น','ม้วน','คู่','ชิ้น','กระป๋อง']) AS u,
           generate_series(1,9) AS ord
    UNION ALL
    SELECT DISTINCT trim(unit), 100 FROM public.stock_items WHERE coalesce(trim(unit),'') <> ''
  ) s GROUP BY u
) t
WHERE NOT EXISTS (SELECT 1 FROM public.config c WHERE c.config_type='stock_unit' AND c.config_value=t.u);

-- สิทธิ์ปุ่มเพิ่มหน่วย (admin ล็อกไว้ใน code ไม่ต้องมีแถว)
INSERT INTO public.role_permissions (role, permission_key, allowed, updated_at, updated_by) VALUES
  ('supervisor','stockAddUnit',true, now(),'migration 2026-09-26'),
  ('office',    'stockAddUnit',true, now(),'migration 2026-09-26'),
  ('manager',   'stockAddUnit',false,now(),'migration 2026-09-26'),
  ('staff',     'stockAddUnit',false,now(),'migration 2026-09-26')
ON CONFLICT (role, permission_key) DO NOTHING;
