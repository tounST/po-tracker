-- ═══════════════════════════════════════════════════════════════════════
--  โมดูลคลังสต๊อก — บันทึกสิ่งที่ apply เข้า Supabase จริง (2026-07-25)
--  โปรเจค: rkdxbxtakvisroxelrvq
--
--  บันทึกไว้เป็นหลักฐาน/อ้างอิง — ไม่ต้องรันซ้ำ (apply แล้วผ่าน MCP)
--  แต่ถ้าต้องกู้คืน/ทำใหม่ รันได้ ปลอดภัย (idempotent ทุกคำสั่ง)
--
--  ⚠️ สิ่งที่พบตอน apply:
--  1) ตาราง stock_items / stock_movements "มีอยู่ก่อนแล้ว" (สร้างตอนทำ
--     stock.html วันที่ 16 ก.ค.) พร้อมข้อมูลตัวอย่างปลอม 5 รายการ
--  2) โครงสร้างเดิมใช้ ref_type / ref_id (polymorphic) ไม่ใช่ po_number
--     → เลยใช้ของเดิม: ref_type='po', ref_id=<เลข PO> สำหรับผูกการเบิกกับงาน
--  3) CHECK constraint เดิมอนุญาตแค่ in/out/adjust แต่โค้ดเขียน 'initial'
--     → insert ล้มเงียบ ๆ. ซ้ำรอย BUG17 (po_items_status_check) และ
--       BUG19 (users_role_check). แก้โดยขยาย constraint (ข้อ 2 ล่าง)
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1) เพิ่มฟิลด์ที่รายงานกระทรวง (iSingleForm) ต้องใช้ ────────────────
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS source_country text DEFAULT 'ไทย',  -- แหล่งการนำเข้า
  ADD COLUMN IF NOT EXISTS ministry_seq   integer;             -- ลำดับในฟอร์ม 1-15

CREATE INDEX IF NOT EXISTS stock_movements_ref_idx
  ON public.stock_movements (ref_type, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_item_created_idx
  ON public.stock_movements (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_items_active_idx
  ON public.stock_items (is_active, name);

-- RLS permissive + realtime — เหมือนทุกตารางในโปรเจคนี้
-- (แอป login ด้วย PIN เทียบตาราง users ไม่ใช่ Supabase Auth → auth.uid()
--  เป็น NULL เสมอ ถ้าตั้ง policy เข้มจะล็อกทุกคนออก)
ALTER TABLE public.stock_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all ON public.stock_items;
CREATE POLICY allow_all ON public.stock_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all ON public.stock_movements;
CREATE POLICY allow_all ON public.stock_movements
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- ── 2) ขยาย CHECK constraint ให้รับ 'initial' ──────────────────────────
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY['in'::text,'out'::text,'adjust'::text,'initial'::text]));


-- ── 3) ปิดใช้งานข้อมูลตัวอย่างปลอม 5 รายการ (soft-delete กู้คืนได้) ────
UPDATE public.stock_items
SET is_active = false, note = coalesce(note,'') || ' [ตัวอย่างเดิม ปิดใช้งาน 2026-07-25]'
WHERE ministry_seq IS NULL AND is_active = true;


-- ── 4) วัตถุดิบจริง 15 รายการ (รายงานกระทรวง พ.ค. 2569) ────────────────
--   qty_current = คงเหลือ ณ สิ้นเดือน พ.ค. 2569 (จากฟอร์ม)
--   qty_min     = ครึ่งหนึ่งของปริมาณที่ใช้ในเดือน พ.ค. — เป็นค่าเริ่มต้น
--                 ที่ "แนะนำ" ไม่ใช่ตัวเลขจากกระทรวง แก้ได้ในหน้าจอ
INSERT INTO public.stock_items
  (ministry_seq, name, category, unit, qty_current, qty_min, cost_per_unit, source_country, note)
SELECT * FROM (VALUES
  ( 1, 'แลคเกอร์',             'แลคเกอร์',        'ชุด',       44::numeric,  18::numeric,  630::numeric, 'ไทย', NULL::text),
  ( 2, 'กระดาษหนังสือพิมพ์',  'วัสดุสิ้นเปลือง', 'กิโลกรัม', 110,          18,            25, 'ไทย', 'ใช้ปิดบังงานตอนพ่น'),
  ( 3, 'ยาขัดชักเงา',          'เคมีขัด',         'ลิตร',       6,           3,           985, 'ไทย', NULL),
  ( 4, 'กระดาษทรายขัดแห้ง',   'วัสดุขัด',        'แผ่น',     460,         225,            17, 'ไทย', NULL),
  ( 5, 'ถุงมือยาง',            'วัสดุสิ้นเปลือง', 'คู่',      200,          50,             2, 'ไทย', NULL),
  ( 6, 'ยาขัดหยาบ',            'เคมีขัด',         'กิโลกรัม',  39.4,       17,           257, 'ไทย', NULL),
  ( 7, 'ใบปัดขนแกะ',           'วัสดุขัด',        'ชิ้น',       9,           4,           546, 'ไทย', NULL),
  ( 8, 'กระดาษทรายขัดน้ำ',    'วัสดุขัด',        'แผ่น',     140,         290,            10, 'ไทย', NULL),
  ( 9, 'กาวผสมสี',             'สี',              'กิโลกรัม', 130,          60,           144, 'ไทย', NULL),
  (10, 'ทินเนอร์',             'ทินเนอร์',        'กิโลกรัม',  80,         250,            45, 'ไทย', NULL),
  (11, 'สีพื้น',               'สี',              'ลิตร',     265,         125,            94, 'ไทย', NULL),
  (12, 'กระดาษกาวย่น',         'วัสดุสิ้นเปลือง', 'ม้วน',     250,         225,             5, 'ไทย', NULL),
  (13, 'สีจริง',               'สี',              'ลิตร',      18,          13,          1300, 'ไทย', NULL),
  (14, 'สีโป๊วพลาสติก',        'สีโป๊ว',          'กิโลกรัม',   9,           6,            43, 'ไทย', NULL),
  (15, 'สีโป๊วแดง',            'สีโป๊ว',          'กิโลกรัม',  15,          18,           140, 'ไทย', NULL)
) AS v(ministry_seq, name, category, unit, qty_current, qty_min, cost_per_unit, source_country, note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_items s WHERE s.ministry_seq = v.ministry_seq
);


-- ── 5) ยอดตั้งต้นเป็น movement — ทุกยอดต้องมีที่มา ตรวจย้อนได้ ─────────
INSERT INTO public.stock_movements
  (item_id, movement_type, qty, balance_after, note, created_by)
SELECT i.id, 'initial', i.qty_current, i.qty_current,
       'ยอดตั้งต้นจากรายงานกระทรวง พ.ค. 2569', 'ระบบ'
FROM public.stock_items i
WHERE i.ministry_seq BETWEEN 1 AND 15
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_movements m
    WHERE m.item_id = i.id AND m.movement_type = 'initial'
  );


-- ── ผลลัพธ์ที่ได้จริง (ตรวจแล้ว 2026-07-25) ────────────────────────────
--   วัสดุใช้งาน 15 · ตัวอย่างเก่าปิดใช้งาน 5 · movement 15
--   มูลค่าคงคลังรวม 135,406.80 บาท · ใกล้หมด 3 รายการ


-- ═══════════════════════════════════════════════════════════════════════
--  เพิ่มภายหลัง (2026-07-25) — ตีตราราคาลงทุกรายการ
--
--  ปัญหาเดิม: มูลค่าทุกรายงานคิดจาก qty × stock_items.cost_per_unit ซึ่งเป็น
--  ช่องเดียวที่แก้ได้ → พอซื้อของแพงขึ้นแล้วอัปเดตราคา มูลค่าของเดือนที่ผ่าน
--  มาแล้วก็เปลี่ยนตามไปด้วย ประวัติจึงเชื่อถือไม่ได้
--
--  วิธีแก้: บันทึกราคาที่ใช้จริงติดไปกับทุก movement
--   - รับเข้า  → unit_cost = ราคาที่จ่ายครั้งนั้น แล้วคำนวณ
--                stock_items.cost_per_unit ใหม่เป็นค่าเฉลี่ยเคลื่อนที่:
--                (คงเหลือ×เฉลี่ยเดิม + จำนวนรับ×ราคาใหม่) ÷ (คงเหลือ+จำนวนรับ)
--   - อื่น ๆ   → unit_cost = ค่าเฉลี่ยที่ยืนอยู่ ณ ขณะนั้น
--
--  ทำไมเฉลี่ยเคลื่อนที่ ไม่ใช่ FIFO: สี/ทินเนอร์เทรวมถังกัน แยกล็อตไม่ได้จริง
--  FIFO layers จึงไม่ตรงกับของจริงและซับซ้อนกว่าโดยไม่ได้ประโยชน์เพิ่ม
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS unit_cost numeric;

-- เติมย้อนหลังด้วยราคาปัจจุบันของวัสดุ เพื่อไม่ให้รายงานมีช่องว่าง
-- (เป็นค่าประมาณโดยธรรมชาติ เพราะก่อนหน้านี้ไม่มีราคาต่อรายการ แต่ตรงกับ
--  ตัวเลขที่โค้ดเดิมรายงานอยู่แล้ว)
UPDATE public.stock_movements m
SET unit_cost = i.cost_per_unit
FROM public.stock_items i
WHERE m.item_id = i.id AND m.unit_cost IS NULL;


-- ═══════════════════════════════════════════════════════════════════════
--  รอบที่ 2 (2026-07-25) — แก้ยอดเพี้ยน + สิทธิ์ + ยกเลิกรายการ
-- ═══════════════════════════════════════════════════════════════════════

-- ── A) ยอดเพี้ยนเมื่อสองคนทำพร้อมกัน (lost update) ────────────────────
-- เดิม client อ่าน qty_current เข้าหน่วยความจำ คำนวณยอดใหม่ แล้วเขียนทับ
-- สองคนเบิกวัสดุเดียวกันในวินาทีเดียว ทั้งคู่อ่านยอดเดิม ทั้งคู่เขียนค่าเดียวกัน
-- → การเบิกครั้งหนึ่งหายไปเงียบ ๆ. โรงงานหลายจุดงานเจอแน่ ไม่ใช่แค่ความเสี่ยง
--
-- ย้ายทุกอย่างเข้า function เดียวที่ล็อกแถววัสดุ (FOR UPDATE) → รายการที่เข้ามา
-- พร้อมกันจะเข้าคิว ไม่ทับกัน  (ดู apply_stock_movement)
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS reverses_id uuid REFERENCES public.stock_movements(id);
CREATE INDEX IF NOT EXISTS stock_movements_reverses_idx
  ON public.stock_movements (reverses_id) WHERE reverses_id IS NOT NULL;

-- function apply_stock_movement(item, type, qty, unit_cost, po, note, by)
-- function reverse_stock_movement(movement_id, note, by)
--   → ดูตัวเต็มใน Supabase (migration: stock_atomic_movement_and_reversal)
--   ทดสอบแล้ว: 100 − 10 − 10 + 80(@60) = 160 คงเหลือ, เฉลี่ย 55 ถูกต้อง

-- ── B) สิทธิ์เฉพาะของคลังสต๊อก — ค่าเริ่มต้น Admin เท่านั้น ─────────────
-- เดิมยืม manageDataAdd / manageDataDelete ของ master data มาใช้ และปุ่ม
-- รับเข้า/เบิกออก/ปรับยอด ไม่เช็คสิทธิ์เลย — ใครล็อกอินได้ก็แก้สต๊อกได้
-- รวมถึงปรับยอด ซึ่งเป็นจุดที่ของหายได้โดยไม่มีใครรู้
INSERT INTO public.role_permissions (role, permission_key, allowed, updated_by)
SELECT r.role, k.key, (r.role = 'admin'), 'ระบบ (ตั้งค่าเริ่มต้น)'
FROM (VALUES ('admin'),('supervisor'),('office'),('manager'),('staff')) AS r(role)
CROSS JOIN (VALUES ('stockIn'),('stockOut'),('stockAdjust'),('stockReverse')) AS k(key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions p
  WHERE p.role = r.role AND p.permission_key = k.key
);
-- Admin เปิด/ปิดให้ role อื่นได้เองจากแท็บ 🔐 สิทธิ์ ในหน้าคลังสต๊อก
-- แถว admin ถูกล็อก 3 ชั้น (UI disabled + savePerm ปฏิเสธ + loadRolePermissions
-- ไม่สนใจแถว admin) กันปิดกั้นตัวเองแล้วเข้าไปแก้ไม่ได้ — แบบเดียวกับ PO app


-- ═══════════════════════════════════════════════════════════════════════
--  รอบที่ 3 — เอกสารรับเข้า · ค่ากลาง · รายงานกระทรวง
-- ═══════════════════════════════════════════════════════════════════════

-- ข้อ 9: ค่ากลาง — ระดับที่ควรเติมกลับถึง
--   qty_min    = ห้ามต่ำกว่านี้ (จุดเตือน)
--   qty_target = ค่ากลาง
--   จำนวนที่ควรสั่ง = qty_target − qty_current (คำนวณสด ไม่เก็บ)
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS qty_target numeric;

-- ข้อ 6: เอกสารประกอบการรับเข้า — เก็บที่ระดับ movement เพราะใบส่งของผูกกับ
-- "การรับของครั้งนั้น" ไม่ใช่ผูกกับตัววัสดุ
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS doc_no    text,
  ADD COLUMN IF NOT EXISTS supplier  text,
  ADD COLUMN IF NOT EXISTS photo_url text;
CREATE INDEX IF NOT EXISTS stock_movements_doc_idx
  ON public.stock_movements (doc_no) WHERE doc_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_supplier_idx
  ON public.stock_movements (supplier) WHERE supplier IS NOT NULL;

-- apply_stock_movement รับพารามิเตอร์เอกสารเพิ่ม 3 ตัว (default NULL)
--   → ดูตัวเต็มใน Supabase (migration: stock_docs_target_and_photo)

-- สิทธิ์ดูเอกสาร/ราคา — ค่าเริ่มต้น Admin เท่านั้น เปิดให้คนอื่นได้จากแท็บ 🔐 สิทธิ์
INSERT INTO public.role_permissions (role, permission_key, allowed, updated_by)
SELECT r.role, 'viewStockDocs', (r.role = 'admin'), 'ระบบ (ตั้งค่าเริ่มต้น)'
FROM (VALUES ('admin'),('supervisor'),('office'),('manager'),('staff')) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions p
  WHERE p.role = r.role AND p.permission_key = 'viewStockDocs'
);

-- ที่เก็บรูปใบส่งของ (bucket 'stock-docs', public read, จำกัด 5 MB, เฉพาะรูป)
-- รูปถูกย่อเหลือด้านยาว 1400px + JPEG q0.72 ที่ฝั่ง client ก่อนอัปโหลด
-- ~150-300 KB ต่อใบ ทำให้ Storage ไม่บวมและอัปโหลดผ่าน 4G ได้เร็ว
