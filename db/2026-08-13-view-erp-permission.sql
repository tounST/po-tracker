-- Applied to Supabase rkdxbxtakvisroxelrvq on 2026-08-13
--
-- WHY
-- toun asked for a way back from PO Tracker up to the ERP shell, "but only for
-- people who are allowed in". Checking the code showed erp.html and stock.html
-- had no gate at all — any valid PIN got in. That held up only because nobody
-- knew the URLs, which is not access control: a bookmark, browser history or a
-- forwarded link defeats it, and adding a visible button would have spread the
-- URL to every worker's screen.
--
-- So viewERP now does two jobs: it hides the way back on the PO pages, and the
-- ERP pages refuse anyone without it on the way in (fresh login and resumed
-- session alike). Seeding the flag here is what makes it editable from the
-- Permissions screen instead of needing a deploy.
--
-- Defaults: the office roles may enter, the shop floor may not. stock.html is
-- covered by the same flag because it is an ERP module and shows unit costs and
-- supplier prices — the stockIn/stockOut flags govern who may change stock, not
-- who may look at what it is worth.
--
-- Admin rows are ignored on read by every client (defence against locking
-- yourself out), so the admin row here is documentation, not enforcement.

insert into role_permissions (role, permission_key, allowed, updated_at, updated_by)
values ('admin',      'viewERP', true,  now(), 'system'),
       ('supervisor', 'viewERP', true,  now(), 'system'),
       ('office',     'viewERP', true,  now(), 'system'),
       ('manager',    'viewERP', true,  now(), 'system'),
       ('staff',      'viewERP', false, now(), 'system')
on conflict (role, permission_key)
  do update set allowed = excluded.allowed, updated_at = now();
