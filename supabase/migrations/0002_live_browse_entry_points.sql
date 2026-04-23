create or replace function public.find_nearest_venues(
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
  postal_code text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision,
  last_verified_at timestamptz,
  tracked_game_count bigint
)
set search_path = public, extensions
language sql
stable
as $$
  with origin as (
    select extensions.st_setsrid(
      extensions.st_makepoint(user_lng, user_lat),
      4326
    )::extensions.geography as point
  )
  select
    v.id as venue_id,
    v.name as venue_name,
    v.slug as venue_slug,
    v.street_address,
    v.city,
    v.region,
    v.postal_code,
    extensions.st_y(v.location::extensions.geometry) as latitude,
    extensions.st_x(v.location::extensions.geometry) as longitude,
    extensions.st_distance(v.location, origin.point) as distance_meters,
    v.last_verified_at,
    count(vg.id) filter (
      where vg.availability_status in (
        'confirmed_present',
        'rumored_present',
        'temporarily_unavailable'
      )
    )::bigint as tracked_game_count
  from public.venues v
  cross join origin
  left join public.venue_games vg on vg.venue_id = v.id
  where
    v.status = 'active'
    and extensions.st_dwithin(v.location, origin.point, max_distance_meters)
  group by
    v.id,
    v.name,
    v.slug,
    v.street_address,
    v.city,
    v.region,
    v.postal_code,
    v.location,
    v.last_verified_at,
    origin.point
  order by
    extensions.st_distance(v.location, origin.point) asc,
    v.name asc
  limit greatest(result_limit, 1);
$$;

create or replace function public.get_venue_details(
  selected_venue_id uuid
)
returns table (
  venue_id uuid,
  venue_name text,
  venue_slug text,
  street_address text,
  city text,
  region text,
  postal_code text,
  country text,
  latitude double precision,
  longitude double precision,
  source text,
  venue_status text,
  last_verified_at timestamptz,
  metadata jsonb,
  verified_report_count bigint,
  game_id uuid,
  game_slug text,
  game_title text,
  manufacturer text,
  release_year integer,
  aliases text[],
  quantity integer,
  availability_status text,
  machine_label text,
  notes text,
  confidence_score numeric,
  last_seen_at timestamptz,
  last_confirmed_at timestamptz
)
set search_path = public, extensions
language sql
stable
as $$
  select
    v.id as venue_id,
    v.name as venue_name,
    v.slug as venue_slug,
    v.street_address,
    v.city,
    v.region,
    v.postal_code,
    v.country,
    extensions.st_y(v.location::extensions.geometry) as latitude,
    extensions.st_x(v.location::extensions.geometry) as longitude,
    v.source,
    v.status as venue_status,
    v.last_verified_at,
    v.metadata,
    (
      select count(*)::bigint
      from public.inventory_reports ir
      where
        ir.venue_id = v.id
        and ir.status = 'approved'
    ) as verified_report_count,
    g.id as game_id,
    g.slug as game_slug,
    g.title as game_title,
    g.manufacturer,
    g.release_year,
    g.aliases,
    vg.quantity,
    vg.availability_status,
    vg.machine_label,
    coalesce(vg.notes, nullif(v.metadata ->> 'notes', '')) as notes,
    vg.confidence_score,
    vg.last_seen_at,
    coalesce(vg.last_confirmed_at, v.last_verified_at) as last_confirmed_at
  from public.venues v
  left join public.venue_games vg
    on vg.venue_id = v.id
    and vg.availability_status in (
      'confirmed_present',
      'rumored_present',
      'temporarily_unavailable'
    )
  left join public.games g on g.id = vg.game_id
  where v.id = selected_venue_id
  order by
    case vg.availability_status
      when 'confirmed_present' then 0
      when 'temporarily_unavailable' then 1
      when 'rumored_present' then 2
      else 3
    end,
    g.title asc nulls last;
$$;
