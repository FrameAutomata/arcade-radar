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
  tracked_game_count bigint,
  verified_report_count bigint,
  notes text
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
    count(distinct vg.id) filter (
      where vg.availability_status in (
        'confirmed_present',
        'rumored_present',
        'temporarily_unavailable'
      )
    )::bigint as tracked_game_count,
    count(distinct ir.id) filter (
      where ir.status = 'approved'
    )::bigint as verified_report_count,
    nullif(v.metadata ->> 'notes', '') as notes
  from public.venues v
  cross join origin
  left join public.venue_games vg on vg.venue_id = v.id
  left join public.inventory_reports ir on ir.venue_id = v.id
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
    v.metadata,
    origin.point
  order by
    extensions.st_distance(v.location, origin.point) asc,
    v.name asc
  limit greatest(result_limit, 1);
$$;
