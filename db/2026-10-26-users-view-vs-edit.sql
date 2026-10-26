-- 2026-10-26 · applied as migration `users_view_vs_edit_permissions`
-- toun: "ยกทุกอย่างให้ admin ทำได้คนเดียว (แก้ไข) · สุรชัยกับออฟฟิศเห็นรหัสได้
--        แต่ไม่เห็นของแอดมินเด็ดขาด"
--   editUsers   (new) — add/edit/delete users + change PINs: admin only
--   manageUsers       — view the user list + other people's PINs: admin, supervisor, office
-- The "never show/allow an admin's PIN to a non-admin" rule is enforced in code
-- (canSeePinOf / canEditUser in po-mobile, po-desktop, erp), not by a flag.
-- NOTE: screen-level only — the users table is still readable with the public
-- anon key until the login moves server-side (task.md: ความปลอดภัยระดับ 1).
insert into role_permissions (role, permission_key, allowed, updated_at, updated_by)
values ('admin','editUsers',true,now(),'migration'),
       ('supervisor','editUsers',false,now(),'migration'),
       ('office','editUsers',false,now(),'migration'),
       ('manager','editUsers',false,now(),'migration'),
       ('staff','editUsers',false,now(),'migration'),
       ('office','manageUsers',true,now(),'migration')
on conflict (role, permission_key) do update set allowed = excluded.allowed, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
