alter table public.games
add column if not exists external_ids jsonb not null default '{}'::jsonb,
add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists games_external_ids_gin_idx
  on public.games using gin (external_ids);

create index if not exists games_metadata_gin_idx
  on public.games using gin (metadata);
