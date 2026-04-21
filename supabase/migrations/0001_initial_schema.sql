create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists postgis with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.set_game_search_text()
returns trigger
language plpgsql
as $$
begin
  new.search_text = lower(
    btrim(
      coalesce(new.title, '') || ' ' ||
      coalesce(new.manufacturer, '') || ' ' ||
      coalesce(array_to_string(new.aliases, ' '), '')
    )
  );
  return new;
end;
$$;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  manufacturer text,
  release_year integer,
  aliases text[] not null default '{}',
  search_text text not null default '',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  street_address text,
  city text not null,
  region text not null,
  postal_code text,
  country text not null default 'US',
  google_place_id text unique,
  source text not null default 'community',
  status text not null default 'active' check (status in ('active', 'temporarily_closed', 'inactive')),
  location extensions.geography(point, 4326) not null,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.venue_games (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  availability_status text not null default 'confirmed_present'
    check (
      availability_status in (
        'confirmed_present',
        'rumored_present',
        'temporarily_unavailable',
        'removed'
      )
    ),
  machine_label text,
  notes text,
  confidence_score numeric(3,2) not null default 0.70
    check (confidence_score >= 0 and confidence_score <= 1),
  last_seen_at timestamptz,
  last_confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (venue_id, game_id)
);

create table if not exists public.inventory_reports (
  id uuid primary key default gen_random_uuid(),
  venue_game_id uuid not null references public.venue_games(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null
    check (
      report_type in (
        'confirmed_present',
        'missing',
        'temporarily_unavailable',
        'new_machine',
        'quantity_changed'
      )
    ),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists games_search_text_trgm_idx
  on public.games using gin (search_text extensions.gin_trgm_ops);

create index if not exists venues_location_idx
  on public.venues using gist (location);

create index if not exists venue_games_game_status_idx
  on public.venue_games (game_id, availability_status);

create index if not exists venue_games_venue_idx
  on public.venue_games (venue_id);

create index if not exists inventory_reports_status_idx
  on public.inventory_reports (status, created_at desc);

create trigger set_games_updated_at
before update on public.games
for each row execute function public.set_updated_at();

create trigger set_games_search_text
before insert or update on public.games
for each row execute function public.set_game_search_text();

create trigger set_venues_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

create trigger set_venue_games_updated_at
before update on public.venue_games
for each row execute function public.set_updated_at();

alter table public.games enable row level security;
alter table public.venues enable row level security;
alter table public.venue_games enable row level security;
alter table public.inventory_reports enable row level security;

create policy "games_are_publicly_readable"
on public.games
for select
to anon, authenticated
using (true);

create policy "venues_are_publicly_readable"
on public.venues
for select
to anon, authenticated
using (true);

create policy "venue_games_are_publicly_readable"
on public.venue_games
for select
to anon, authenticated
using (true);

create policy "authenticated_users_can_create_inventory_reports"
on public.inventory_reports
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users_can_read_their_own_reports"
on public.inventory_reports
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.search_games(
  search_query text,
  result_limit integer default 8
)
returns table (
  game_id uuid,
  slug text,
  title text,
  manufacturer text,
  release_year integer,
  aliases text[],
  similarity_score real
)
set search_path = public, extensions
language sql
stable
as $$
  select
    g.id as game_id,
    g.slug,
    g.title,
    g.manufacturer,
    g.release_year,
    g.aliases,
    greatest(
      extensions.similarity(g.search_text, lower(search_query)),
      extensions.similarity(lower(g.title), lower(search_query))
    ) as similarity_score
  from public.games g
  where
    lower(g.title) like '%' || lower(search_query) || '%'
    or g.search_text % lower(search_query)
    or exists (
      select 1
      from unnest(g.aliases) alias
      where lower(alias) like '%' || lower(search_query) || '%'
    )
  order by
    case when lower(g.title) = lower(search_query) then 0 else 1 end,
    case when lower(g.title) like lower(search_query) || '%' then 0 else 1 end,
    similarity_score desc,
    g.title asc
  limit greatest(result_limit, 1);
$$;

create or replace function public.find_nearest_venues_for_game(
  selected_game_id uuid,
  user_lat double precision,
  user_lng double precision,
  max_distance_meters integer default 80467,
  result_limit integer default 25
)
returns table (
  venue_id uuid,
  venue_name text,
  venue_slug text,
  street_address text,
  city text,
  region text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  quantity integer,
  availability_status text,
  last_confirmed_at timestamptz,
  confidence_score numeric
)
set search_path = public, extensions
language sql
stable
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(user_lng, user_lat), 4326)::extensions.geography as point
  )
  select
    v.id as venue_id,
    v.name as venue_name,
    v.slug as venue_slug,
    v.street_address,
    v.city,
    v.region,
    extensions.st_y(v.location::extensions.geometry) as latitude,
    extensions.st_x(v.location::extensions.geometry) as longitude,
    extensions.st_distance(v.location, origin.point) as distance_meters,
    vg.quantity,
    vg.availability_status,
    coalesce(vg.last_confirmed_at, v.last_verified_at) as last_confirmed_at,
    vg.confidence_score
  from public.venue_games vg
  join public.venues v on v.id = vg.venue_id
  cross join origin
  where
    vg.game_id = selected_game_id
    and v.status = 'active'
    and vg.availability_status in (
      'confirmed_present',
      'temporarily_unavailable',
      'rumored_present'
    )
    and extensions.st_dwithin(v.location, origin.point, max_distance_meters)
  order by
    case vg.availability_status
      when 'confirmed_present' then 0
      when 'temporarily_unavailable' then 1
      else 2
    end,
    coalesce(vg.last_confirmed_at, v.last_verified_at) desc nulls last,
    extensions.st_distance(v.location, origin.point) asc
  limit greatest(result_limit, 1);
$$;
