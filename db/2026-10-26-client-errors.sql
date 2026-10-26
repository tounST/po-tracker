-- 2026-10-26 · applied as migration `client_errors_table` (task.md B2)
-- Browser error log. All four pages POST uncaught errors / failed script loads /
-- console.error() here (anon key, plain fetch). The nightly GitHub Action
-- (.github/workflows/nightly-backup.yml) reads the last 24 h, opens a GitHub
-- issue when there are any, and deletes rows older than 60 days.
-- No user identity is stored. CHECKs cap every text field so a misbehaving
-- page (or anyone holding the public anon key) cannot fill the table with junk.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page text not null check (char_length(page) <= 40),
  kind text not null check (kind in ('error','rejection','console')),
  message text not null check (char_length(message) <= 500),
  source text check (char_length(source) <= 200),
  stack text check (char_length(stack) <= 2000),
  app_version text check (char_length(app_version) <= 40),
  user_agent text check (char_length(user_agent) <= 300)
);
create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
-- Browsers may only add rows; the nightly job reads them and prunes old ones.
-- No UPDATE policy at all; DELETE only for rows past retention.
create policy client_errors_insert on public.client_errors for insert to anon with check (true);
create policy client_errors_select on public.client_errors for select to anon using (true);
create policy client_errors_delete_old on public.client_errors for delete to anon using (created_at < now() - interval '60 days');
