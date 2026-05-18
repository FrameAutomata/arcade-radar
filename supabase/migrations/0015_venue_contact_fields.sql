-- Add structured contact and operational columns to venues.
-- These fields were previously crammed into the metadata JSONB blob with no
-- schema enforcement.  Moving them to first-class columns gives us type safety,
-- simpler queries, and the ability to index/filter on them later.

-- ─── 1. New columns ───────────────────────────────────────────────────────────

alter table public.venues
  add column if not exists phone       text,
  add column if not exists website     text,
  add column if not exists entry_fee   text,
  add column if not exists hours       jsonb,
  add column if not exists facebook    text,
  add column if not exists twitter     text,
  add column if not exists description text;

-- ─── 2. Migrate existing metadata data into proper columns ───────────────────
-- Non-destructive: keeps metadata intact for any other consumers.
-- coalesce() ensures we don't overwrite a column that was already populated.

update public.venues
set
  website     = coalesce(website,     nullif(trim(metadata->>'website'), '')),
  description = coalesce(description, nullif(trim(metadata->>'notes'),   ''))
where metadata != '{}'::jsonb;

-- ─── 3. Rebuild find_nearest_venues ─────────────────────────────────────────
-- Reads description from the proper column (with metadata fallback for any
-- row that wasn't touched by the update above).

drop function if exists public.find_nearest_venues(
  double precision, double precision, integer, integer
);

create function public.find_nearest_venues(
  user_lat             double precision,
  user_lng             double precision,
  max_distance_meters  integer          default 80467,
  result_limit         integer          default 25
)
returns table (
  venue_id             uuid,
  venue_name           text,
  venue_slug           text,
  street_address       text,
  city                 text,
  region               text,
  postal_code          text,
  latitude             double precision,
  longitude            double precision,
  distance_meters      double precision,
  last_verified_at     timestamptz,
  tracked_game_count   bigint,
  verified_report_count bigint,
  notes                text
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
    v.id                                                              as venue_id,
    v.name                                                            as venue_name,
    v.slug                                                            as venue_slug,
    v.street_address,
    v.city,
    v.region,
    v.postal_code,
    extensions.st_y(v.location::extensions.geometry)                 as latitude,
    extensions.st_x(v.location::extensions.geometry)                 as longitude,
    extensions.st_distance(v.location, origin.point)                 as distance_meters,
    v.last_verified_at,
    count(vg.id) filter (
      where vg.availability_status in (
        'confirmed_present', 'rumored_present', 'temporarily_unavailable'
      )
    )::bigint                                                         as tracked_game_count,
    count(ir.id) filter (
      where ir.status = 'approved'
    )::bigint                                                         as verified_report_count,
    coalesce(v.description, nullif(v.metadata->>'notes', ''))        as notes
  from public.venues v
  cross join origin
  left join public.venue_games       vg on vg.venue_id = v.id
  left join public.inventory_reports ir on ir.venue_id = v.id
  where
    v.status = 'active'
    and extensions.st_dwithin(v.location, origin.point, max_distance_meters)
  group by
    v.id, v.name, v.slug, v.street_address, v.city, v.region,
    v.postal_code, v.location, v.last_verified_at, v.description,
    v.metadata, origin.point
  order by
    extensions.st_distance(v.location, origin.point) asc,
    v.name asc
  limit greatest(result_limit, 1);
$$;

-- ─── 4. Rebuild get_venue_details with all new fields ─────────────────────────
-- Return type changes (new columns added), so we must drop first.

drop function if exists public.get_venue_details(uuid);

create function public.get_venue_details(
  selected_venue_id uuid
)
returns table (
  -- venue identity
  venue_id          uuid,
  venue_name        text,
  venue_slug        text,
  -- location
  street_address    text,
  city              text,
  region            text,
  postal_code       text,
  country           text,
  latitude          double precision,
  longitude         double precision,
  -- operational
  source            text,
  venue_status      text,
  last_verified_at  timestamptz,
  -- contact & links
  phone             text,
  website           text,
  entry_fee         text,
  hours             jsonb,
  facebook          text,
  twitter           text,
  -- description
  venue_description text,
  -- legacy blob (kept for any data not yet migrated)
  metadata          jsonb,
  -- community stats
  verified_report_count bigint,
  -- per-game inventory columns (one row per active game)
  game_id           uuid,
  game_slug         text,
  game_title        text,
  manufacturer      text,
  release_year      integer,
  aliases           text[],
  categories        text[],
  quantity          integer,
  availability_status text,
  machine_label     text,
  notes             text,
  confidence_score  numeric,
  last_seen_at      timestamptz,
  last_confirmed_at timestamptz
)
set search_path = public, extensions
language sql
stable
as $$
  select
    -- venue identity
    v.id                                                             as venue_id,
    v.name                                                           as venue_name,
    v.slug                                                           as venue_slug,
    -- location
    v.street_address,
    v.city,
    v.region,
    v.postal_code,
    v.country,
    extensions.st_y(v.location::extensions.geometry)                as latitude,
    extensions.st_x(v.location::extensions.geometry)                as longitude,
    -- operational
    v.source,
    v.status                                                         as venue_status,
    v.last_verified_at,
    -- contact & links (proper columns)
    v.phone,
    v.website,
    v.entry_fee,
    v.hours,
    v.facebook,
    v.twitter,
    -- description (proper column, fall back to metadata for old rows)
    coalesce(v.description, nullif(v.metadata->>'notes', ''))       as venue_description,
    -- legacy blob
    v.metadata,
    -- community stats
    (
      select count(*)::bigint
      from public.inventory_reports ir
      where ir.venue_id = v.id
        and ir.status = 'approved'
    )                                                                as verified_report_count,
    -- per-game inventory
    g.id                                                             as game_id,
    g.slug                                                           as game_slug,
    g.title                                                          as game_title,
    g.manufacturer,
    g.release_year,
    g.aliases,
    g.categories,
    vg.quantity,
    vg.availability_status,
    vg.machine_label,
    vg.notes,
    vg.confidence_score,
    vg.last_seen_at,
    coalesce(vg.last_confirmed_at, v.last_verified_at)              as last_confirmed_at
  from public.venues v
  left join public.venue_games vg
    on  vg.venue_id = v.id
    and vg.availability_status in (
      'confirmed_present', 'rumored_present', 'temporarily_unavailable'
    )
  left join public.games g on g.id = vg.game_id
  where v.id = selected_venue_id
  order by
    case vg.availability_status
      when 'confirmed_present'        then 0
      when 'temporarily_unavailable'  then 1
      when 'rumored_present'          then 2
      else 3
    end,
    g.title asc nulls last;
$$;

-- ─── 5. Rebuild create_venue to store new fields in proper columns ────────────
-- Old 10-parameter signature stored website/notes in metadata; new version
-- uses the dedicated columns.  Drop old signature, create new one.

drop function if exists public.create_venue(
  text, text, text, text, text, text, double precision, double precision, text, text
);

create function public.create_venue(
  venue_name          text,
  venue_street_address text,
  venue_city          text,
  venue_region        text,
  venue_postal_code   text             default null,
  venue_country       text             default 'US',
  venue_latitude      double precision default null,
  venue_longitude     double precision default null,
  venue_website       text             default null,
  venue_notes         text             default null,   -- kept for backward compat; stored as description
  venue_phone         text             default null,
  venue_entry_fee     text             default null,
  venue_hours         jsonb            default null,
  venue_facebook      text             default null,
  venue_twitter       text             default null,
  venue_description   text             default null
)
returns table (
  created_venue_id    uuid,
  created_venue_slug  text,
  created_venue_name  text,
  created_street_address text,
  created_city        text,
  created_region      text,
  created_postal_code text,
  created_country     text,
  created_latitude    double precision,
  created_longitude   double precision
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  normalized_name           text := nullif(btrim(venue_name), '');
  normalized_street_address text := nullif(btrim(venue_street_address), '');
  normalized_city           text := nullif(btrim(venue_city), '');
  normalized_region         text := upper(nullif(btrim(venue_region), ''));
  normalized_postal_code    text := nullif(btrim(venue_postal_code), '');
  normalized_country        text := upper(coalesce(nullif(btrim(venue_country), ''), 'US'));
  normalized_website        text := nullif(btrim(venue_website), '');
  normalized_phone          text := nullif(btrim(venue_phone), '');
  normalized_entry_fee      text := nullif(btrim(venue_entry_fee), '');
  normalized_facebook       text := nullif(btrim(venue_facebook), '');
  normalized_twitter        text := nullif(btrim(venue_twitter), '');
  -- venue_description wins; fall back to venue_notes for callers using the old param
  normalized_description    text := coalesce(
    nullif(btrim(venue_description), ''),
    nullif(btrim(venue_notes), '')
  );
  generated_slug text;
  final_slug     text;
  resulting_venue public.venues%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_scout_access() then
    raise exception 'Scout or admin access is required';
  end if;

  if normalized_name is null then
    raise exception 'venue_name is required';
  end if;

  if normalized_city is null or normalized_region is null then
    raise exception 'venue_city and venue_region are required';
  end if;

  if venue_latitude is null or venue_longitude is null then
    raise exception 'Venue coordinates are required';
  end if;

  select private.slugify_text(normalized_name) into generated_slug;

  if generated_slug is null or generated_slug = '' then
    raise exception 'Could not generate a slug for this venue';
  end if;

  final_slug := generated_slug;

  if exists (select 1 from public.venues where slug = final_slug) then
    final_slug := final_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  insert into public.venues (
    slug, name, street_address, city, region, postal_code, country,
    source, status, location,
    phone, website, entry_fee, hours, facebook, twitter, description,
    metadata
  )
  values (
    final_slug,
    normalized_name,
    normalized_street_address,
    normalized_city,
    normalized_region,
    normalized_postal_code,
    normalized_country,
    'scout',
    'active',
    extensions.st_setsrid(
      extensions.st_makepoint(venue_longitude, venue_latitude),
      4326
    )::extensions.geography,
    normalized_phone,
    normalized_website,
    normalized_entry_fee,
    venue_hours,
    normalized_facebook,
    normalized_twitter,
    normalized_description,
    '{}'::jsonb
  )
  returning * into resulting_venue;

  return query
  select
    resulting_venue.id,
    resulting_venue.slug,
    resulting_venue.name,
    resulting_venue.street_address,
    resulting_venue.city,
    resulting_venue.region,
    resulting_venue.postal_code,
    resulting_venue.country,
    extensions.st_y(resulting_venue.location::extensions.geometry) as latitude,
    extensions.st_x(resulting_venue.location::extensions.geometry) as longitude;
end;
$$;

revoke execute on function public.create_venue(
  text, text, text, text, text, text, double precision, double precision,
  text, text, text, text, jsonb, text, text, text
) from public, anon;

grant execute on function public.create_venue(
  text, text, text, text, text, text, double precision, double precision,
  text, text, text, text, jsonb, text, text, text
) to authenticated;
