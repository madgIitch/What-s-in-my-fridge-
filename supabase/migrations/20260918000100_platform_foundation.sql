create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  locale text not null default 'es-ES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legacy_id_map (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'FIREBASE' check (source = 'FIREBASE'),
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  legacy_id text not null check (char_length(legacy_id) between 1 and 512),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (source, entity_type, legacy_id),
  unique (user_id, entity_type, target_id)
);

create table public.migration_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  source_commit text not null check (source_commit ~ '^[0-9a-f]{7,40}$'),
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  check ((status = 'running' and finished_at is null) or status <> 'running')
);

create or replace function public.owns_row(row_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select auth.uid() is not null and auth.uid() = row_user_id $$;

revoke all on function public.owns_row(uuid) from public;
grant execute on function public.owns_row(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.legacy_id_map enable row level security;
alter table public.migration_runs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (public.owns_row(user_id));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (public.owns_row(user_id));
create policy "profiles_update_own" on public.profiles for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (public.owns_row(user_id));

create policy "legacy_map_select_own" on public.legacy_id_map for select to authenticated using (public.owns_row(user_id));
create policy "legacy_map_insert_own" on public.legacy_id_map for insert to authenticated with check (public.owns_row(user_id));
create policy "legacy_map_update_own" on public.legacy_id_map for update to authenticated using (public.owns_row(user_id)) with check (public.owns_row(user_id));
create policy "legacy_map_delete_own" on public.legacy_id_map for delete to authenticated using (public.owns_row(user_id));

create policy "migration_runs_select_own" on public.migration_runs for select to authenticated using (public.owns_row(created_by));
create policy "migration_runs_insert_own" on public.migration_runs for insert to authenticated with check (public.owns_row(created_by));
create policy "migration_runs_update_own" on public.migration_runs for update to authenticated using (public.owns_row(created_by)) with check (public.owns_row(created_by));
create policy "migration_runs_delete_own" on public.migration_runs for delete to authenticated using (public.owns_row(created_by));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts-temp', 'receipts-temp', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('user-assets', 'user-assets', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_select_own" on storage.objects for select to authenticated
using (bucket_id in ('receipts-temp', 'user-assets') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_insert_own" on storage.objects for insert to authenticated
with check (bucket_id in ('receipts-temp', 'user-assets') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_update_own" on storage.objects for update to authenticated
using (bucket_id in ('receipts-temp', 'user-assets') and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id in ('receipts-temp', 'user-assets') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage_delete_own" on storage.objects for delete to authenticated
using (bucket_id in ('receipts-temp', 'user-assets') and (storage.foldername(name))[1] = auth.uid()::text);

create index legacy_id_map_user_id_idx on public.legacy_id_map(user_id);
create index migration_runs_created_by_idx on public.migration_runs(created_by, started_at desc);
