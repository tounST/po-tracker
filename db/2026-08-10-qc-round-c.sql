-- Applied to Supabase rkdxbxtakvisroxelrvq on 2026-08-10 via MCP
-- migration name: qc_round_c_photo_note_reasons
--
-- Round C of the design handoff: QC gains an evidence photo, a free-text
-- note, and multi-select defect reasons. Everything here is additive --
-- no column is altered or dropped -- so a client still running the old
-- code keeps working unchanged.

alter table public.po_items add column if not exists qc_photo_url       text;
alter table public.po_items add column if not exists qc_note            text;
alter table public.po_items add column if not exists qc_defect_reasons  text[];

comment on column public.po_items.qc_photo_url      is 'Public URL of the QC evidence photo in the qc-photos bucket.';
comment on column public.po_items.qc_note           is 'Free-text note the inspector left with the verdict.';
comment on column public.po_items.qc_defect_reasons is 'All defect reasons picked. qc_defect_reason holds the same list joined, for older clients.';

-- Photo bucket, same shape as stock-docs: public read, 5 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qc-photos', 'qc-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "qc photos read"  on storage.objects;
drop policy if exists "qc photos write" on storage.objects;
create policy "qc photos read"  on storage.objects for select using (bucket_id = 'qc-photos');
create policy "qc photos write" on storage.objects for insert with check (bucket_id = 'qc-photos');

insert into public.role_permissions (role, permission_key, allowed)
values ('admin','qcPhoto',true), ('supervisor','qcPhoto',true), ('manager','qcPhoto',true),
       ('office','qcPhoto',false), ('staff','qcPhoto',false)
on conflict (role, permission_key) do nothing;

-- WHY qc_defect_reason (singular) stays:
-- po-mobile reads only that column. The desktop writes both -- the array,
-- and the same list joined with " · " into the singular column -- so an
-- item inspected on a PC does not read as reasonless on a phone. Drop the
-- singular column only after po-mobile learns to read the array.
