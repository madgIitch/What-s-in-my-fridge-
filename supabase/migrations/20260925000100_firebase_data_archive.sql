-- Sprint 12: historical legacy fields that have no live-domain equivalent.
-- The active Stripe entitlement and canonical usage counters remain untouched.
create table public.legacy_migration_records (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'FIREBASE' check (source = 'FIREBASE'),
  collection text not null check (collection in ('cookingPreferences','recipe_jobs','usage','subscription')),
  legacy_id text not null,
  canonical_data jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, legacy_id)
);

create index legacy_migration_records_user_collection_idx
  on public.legacy_migration_records(user_id, collection);

alter table public.legacy_migration_records enable row level security;
revoke all on public.legacy_migration_records from anon, authenticated;
