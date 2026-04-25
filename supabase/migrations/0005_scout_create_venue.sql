create policy "scouts_can_insert_venues"
on public.venues
for insert
to authenticated
with check (private.has_scout_access());

create or replace function private.slugify_text(input_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_venue(
  venue_name text,
  venue_street_address text,
  venue_city text,
  venue_region text,
  venue_postal_code text default null,
  venue_country text default 'US',
  venue_latitude double precision default null,
  venue_longitude double precision default null,
  venue_website text default null,
  venue_notes text default null
)
returns table (
  created_venue_id uuid,
  created_venue_slug text,
  created_venue_name text,
  created_street_address text,
  created_city text,
  created_region text,
  created_postal_code text,
  created_country text,
  created_latitude double precision,
  created_longitude double precision
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  normalized_name text := nullif(btrim(venue_name), '');
  normalized_street_address text := nullif(btrim(venue_street_address), '');
  normalized_city text := nullif(btrim(venue_city), '');
  normalized_region text := upper(nullif(btrim(venue_region), ''));
  normalized_postal_code text := nullif(btrim(venue_postal_code), '');
  normalized_country text := upper(coalesce(nullif(btrim(venue_country), ''), 'US'));
  normalized_website text := nullif(btrim(venue_website), '');
  normalized_notes text := nullif(btrim(venue_notes), '');
  generated_slug text;
  final_slug text;
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
    slug,
    name,
    street_address,
    city,
    region,
    postal_code,
    country,
    source,
    status,
    location,
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
    case
      when normalized_website is not null or normalized_notes is not null then
        jsonb_strip_nulls(
          jsonb_build_object(
            'website', normalized_website,
            'notes', normalized_notes
          )
        )
      else '{}'::jsonb
    end
  )
  returning *
  into resulting_venue;

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

revoke execute on function public.create_venue(text, text, text, text, text, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.create_venue(text, text, text, text, text, text, double precision, double precision, text, text) to authenticated;
