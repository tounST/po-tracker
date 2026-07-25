-- ═══════════════════════════════════════════════════════════════════════
--  โมดูลคลังสต๊อก — สร้างตาราง + ใส่วัตถุดิบ 15 รายการ
--  วิธีใช้: เปิด Supabase → SQL Editor → วางทั้งไฟล์ → กด Run
--  ปลอดภัย: ไม่แตะตารางเดิม (po_list / po_items / users / config / ...)
--  รันซ้ำได้: ถ้ามีตารางอยู่แล้วจะข้าม และไม่ใส่วัตถุดิบซ้ำ
--
--  ที่มาข้อมูล: รายงานกระทรวงอุตสาหกรรม (iSingleForm)
--               บจก. เอส.เอ.เอส. กิจอนันต์ — รอบเดือน พฤษภาคม 2569
--
--  สูตรของฟอร์มกระทรวง:  คงเหลือ = ยอดยกมา + ปริมาณที่รับ − ปริมาณที่ใช้
--  ตรวจแล้วถูกต้องครบทั้ง 15 แถว → ตรงกับหลัก movement ledger พอดี
--  ดังนั้น: ทุกการเปลี่ยนแปลงเก็บเป็น 1 แถวใน stock_movements
--          แล้ว qty_current เป็นยอดวิ่ง — ไม่แก้ตัวเลขทับโดยไม่มีประวัติ
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1) ตารางวัสดุ ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  category       text,
  unit           text NOT NULL,
  qty_current    numeric NOT NULL DEFAULT 0,   -- คงเหลือ (ยอดวิ่ง)
  qty_min        numeric NOT NULL DEFAULT 0,   -- จุดเตือน / ขั้นต่ำ
  cost_per_unit  numeric NOT NULL DEFAULT 0,   -- ราคาเฉลี่ยต่อหน่วย (บาท)
  source_country text DEFAULT 'ไทย',           -- แหล่งการนำเข้า (ฟอร์มกระทรวง)
  ministry_seq   integer,                      -- ลำดับในฟอร์มกระทรวง (1-15)
  note           text,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── 2) ตารางประวัติการเคลื่อนไหว (หัวใจของระบบ) ────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  movement_type  text NOT NULL,                -- in | out | adjust | initial
  qty            numeric NOT NULL,
  balance_after  numeric,                      -- คงเหลือหลังทำรายการ
  po_number      text,                         -- เบิกไปงาน PO ไหน (ผูกต้นทุน)
  note           text,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_type_check
    CHECK (movement_type = ANY (ARRAY['in','out','adjust','initial']))
);

CREATE INDEX IF NOT EXISTS stock_movements_item_created_idx
  ON public.stock_movements (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_po_idx
  ON public.stock_movements (po_number) WHERE po_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_items_active_idx
  ON public.stock_items (is_active, name);

-- ── 3) RLS — permissive เหมือนตารางอื่นทั้งหมดในโปรเจคนี้ ───────────────
-- แอป login ด้วย PIN เทียบตาราง users (ไม่ใช่ Supabase Auth) → auth.uid()
-- เป็น NULL เสมอ ถ้าตั้ง policy เข้มจะล็อกทุกคนออก. Realtime ต้องเปิด RLS ด้วย
ALTER TABLE public.stock_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all ON public.stock_items;
CREATE POLICY allow_all ON public.stock_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_all ON public.stock_movements;
CREATE POLICY allow_all ON public.stock_movements
  FOR ALL USING (true) WITH CHECK (true);

-- ── 4) เปิด Realtime (sync ข้ามเครื่อง < 1 วินาที) ─────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── 5) วัตถุดิบ 15 รายการ (จากรายงานกระทรวง พ.ค. 2569) ─────────────────
--   qty_current = คงเหลือ ณ สิ้นเดือน พ.ค. 2569
--   qty_min     = ครึ่งหนึ่งของปริมาณที่ใช้ในเดือน พ.ค. (ค่าเริ่มต้นที่แนะนำ
--                 — แก้ได้ในหน้าจอ ไม่ใช่ตัวเลขจากกระทรวง)
INSERT INTO public.stock_items
  (ministry_seq, name, category, unit, qty_current, qty_min, cost_per_unit, source_country, note)
SELECT * FROM (VALUES
  ( 1, 'แลคเกอร์',              'แลคเกอร์',        'ชุด',      44,    18,     630, 'ไทย', NULL),
  ( 2, 'กระดาษหนังสือพิมพ์',   'วัสดุสิ้นเปลือง', 'กิโลกรัม', 110,    18,      25, 'ไทย', 'ใช้ปิดบังงานตอนพ่น'),
  ( 3, 'ยาขัดชักเงา',           'เคมีขัด',         'ลิตร',       6,     3,     985, 'ไทย', NULL),
  ( 4, 'กระดาษทรายขัดแห้ง',    'วัสดุขัด',        'แผ่น',     460,   225,      17, 'ไทย', NULL),
  ( 5, 'ถุงมือยาง',             'วัสดุสิ้นเปลือง', 'คู่',      200,    50,       2, 'ไทย', NULL),
  ( 6, 'ยาขัดหยาบ',             'เคมีขัด',         'กิโลกรัม',  39.4,  17,     257, 'ไทย', NULL),
  ( 7, 'ใบปัดขนแกะ',            'วัสดุขัด',        'ชิ้น',       9,     4,     546, 'ไทย', NULL),
  ( 8, 'กระดาษทรายขัดน้ำ',     'วัสดุขัด',        'แผ่น',     140,   290,      10, 'ไทย', NULL),
  ( 9, 'กาวผสมสี',              'สี',              'กิโลกรัม', 130,    60,     144, 'ไทย', NULL),
  (10, 'ทินเนอร์',              'ทินเนอร์',        'กิโลกรัม',  80,   250,      45, 'ไทย', NULL),
  (11, 'สีพื้น',                'สี',              'ลิตร',     265,   125,      94, 'ไทย', NULL),
  (12, 'กระดาษกาวย่น',          'วัสดุสิ้นเปลือง', 'ม้วน',     250,   225,       5, 'ไทย', NULL),
  (13, 'สีจริง',                'สี',              'ลิตร',      18,    13,    1300, 'ไทย', NULL),
  (14, 'สีโป๊วพลาสติก',         'สีโป๊ว',          'กิโลกรัม',   9,     6,      43, 'ไทย', NULL),
  (15, 'สีโป๊วแดง',             'สีโป๊ว',          'กิโลกรัม',  15,    18,     140, 'ไทย', NULL)
) AS v(ministry_seq, name, category, unit, qty_current, qty_min, cost_per_unit, source_country, note)
WHERE NOT EXISTS (SELECT 1 FROM public.stock_items WHERE stock_items.name = v.name);

-- ── 6) บันทึกยอดตั้งต้นเป็น movement (ให้ทุกยอดมีที่มา ตรวจย้อนได้) ────
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

-- ── ตรวจผล ─────────────────────────────────────────────────────────────
SELECT ministry_seq AS "ลำดับ", name AS "วัตถุดิบ", category AS "หมวด",
       unit AS "หน่วย", qty_current AS "คงเหลือ", qty_min AS "ขั้นต่ำ",
       cost_per_unit AS "ราคา/หน่วย",
       (qty_current * cost_per_unit) AS "มูลค่า"
FROM public.stock_items
ORDER BY ministry_seq;
