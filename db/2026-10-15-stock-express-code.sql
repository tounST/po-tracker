-- 2026-10-15 · applied as migration `stock_items_express_code`
-- Express accounting link (task.md B11): each material can carry the product
-- code the accountant uses in Express. The monthly "ส่งบัญชี Express" file
-- sums issues / stocktake adjustments by this code. Several materials may share
-- one code (e.g. every shade of สีจริง → one Express item) — they are added up.
-- Optional text, no CHECK, no default: a material without a code is listed as
-- "ยังไม่มีรหัส" in the file instead of being dropped.
alter table public.stock_items add column if not exists express_code text;
comment on column public.stock_items.express_code is 'รหัสสินค้าในโปรแกรมบัญชี Express — ใช้จับคู่ตอนส่งยอดเบิก/ปรับยอดรายเดือนให้บัญชี · หลายรายการใช้รหัสเดียวกันได้ (ยอดจะรวมกัน)';
