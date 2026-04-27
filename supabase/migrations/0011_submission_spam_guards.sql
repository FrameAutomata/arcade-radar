alter table public.venue_submissions
  add column if not exists submission_fingerprint text;

alter table public.game_submissions
  add column if not exists submission_fingerprint text;

create or replace function private.normalize_submission_text(input_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(btrim(coalesce(input_text, ''))), '[^a-z0-9]+', ' ', 'g');
$$;

create or replace function private.venue_submission_fingerprint(
  venue_name text,
  venue_street_address text,
  venue_city text,
  venue_region text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(
    '|',
    regexp_replace(private.normalize_submission_text(venue_name), '\s+', '-', 'g'),
    regexp_replace(private.normalize_submission_text(venue_street_address), '\s+', '-', 'g'),
    regexp_replace(private.normalize_submission_text(venue_city), '\s+', '-', 'g'),
    upper(btrim(coalesce(venue_region, '')))
  );
$$;

create or replace function private.game_submission_fingerprint(
  game_title text,
  game_manufacturer text,
  game_release_year integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(
    '|',
    regexp_replace(private.normalize_submission_text(game_title), '\s+', '-', 'g'),
    regexp_replace(private.normalize_submission_text(game_manufacturer), '\s+', '-', 'g'),
    coalesce(game_release_year::text, '')
  );
$$;

update public.venue_submissions
set submission_fingerprint = private.venue_submission_fingerprint(
  name,
  street_address,
  city,
  region
)
where submission_fingerprint is null;

update public.game_submissions
set submission_fingerprint = private.game_submission_fingerprint(
  title,
  manufacturer,
  release_year
)
where submission_fingerprint is null;

alter table public.venue_submissions
  alter column submission_fingerprint set not null;

alter table public.game_submissions
  alter column submission_fingerprint set not null;

create unique index if not exists venue_submissions_one_pending_duplicate_per_user_idx
  on public.venue_submissions (submitted_by, submission_fingerprint)
  where status = 'pending';

create unique index if not exists game_submissions_one_pending_duplicate_per_user_idx
  on public.game_submissions (submitted_by, submission_fingerprint)
  where status = 'pending';

create index if not exists venue_submissions_user_created_at_idx
  on public.venue_submissions (submitted_by, created_at desc);

create index if not exists game_submissions_user_created_at_idx
  on public.game_submissions (submitted_by, created_at desc);

create or replace function public.submit_venue_submission(
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
  submission_id uuid,
  submission_status text
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := nullif(btrim(venue_name), '');
  normalized_street_address text := nullif(btrim(venue_street_address), '');
  normalized_city text := nullif(btrim(venue_city), '');
  normalized_region text := upper(nullif(btrim(venue_region), ''));
  normalized_postal_code text := nullif(btrim(venue_postal_code), '');
  normalized_country text := upper(coalesce(nullif(btrim(venue_country), ''), 'US'));
  normalized_website text := nullif(btrim(venue_website), '');
  normalized_notes text := nullif(btrim(venue_notes), '');
  normalized_fingerprint text;
  submissions_this_hour integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
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

  select private.venue_submission_fingerprint(
    normalized_name,
    normalized_street_address,
    normalized_city,
    normalized_region
  )
  into normalized_fingerprint;

  if exists (
    select 1
    from public.venue_submissions vs
    where
      vs.submitted_by = current_user_id
      and vs.submission_fingerprint = normalized_fingerprint
      and vs.status = 'pending'
  ) then
    raise exception 'You already submitted this venue for review.';
  end if;

  select count(*)
  into submissions_this_hour
  from public.venue_submissions vs
  where
    vs.submitted_by = current_user_id
    and vs.created_at >= timezone('utc'::text, now()) - interval '1 hour';

  if submissions_this_hour >= 10 then
    raise exception 'Venue submission limit reached. Try again later.';
  end if;

  return query
  insert into public.venue_submissions (
    submitted_by,
    name,
    street_address,
    city,
    region,
    postal_code,
    country,
    latitude,
    longitude,
    website,
    notes,
    submission_fingerprint
  )
  values (
    current_user_id,
    normalized_name,
    normalized_street_address,
    normalized_city,
    normalized_region,
    normalized_postal_code,
    normalized_country,
    venue_latitude,
    venue_longitude,
    normalized_website,
    normalized_notes,
    normalized_fingerprint
  )
  returning
    venue_submissions.id,
    venue_submissions.status;
end;
$$;

create or replace function public.submit_game_submission(
  game_title text,
  game_manufacturer text default null,
  game_release_year integer default null,
  game_aliases text[] default '{}',
  game_categories text[] default '{}',
  game_notes text default null
)
returns table (
  submission_id uuid,
  submission_status text
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_title text := nullif(btrim(game_title), '');
  normalized_manufacturer text := nullif(btrim(game_manufacturer), '');
  normalized_aliases text[] := coalesce(
    array(
      select distinct nullif(btrim(alias_value), '')
      from unnest(coalesce(game_aliases, '{}')) alias_value
      where nullif(btrim(alias_value), '') is not null
    ),
    '{}'::text[]
  );
  normalized_categories text[] := coalesce(
    array(
      select distinct nullif(btrim(category_value), '')
      from unnest(coalesce(game_categories, '{}')) category_value
      where nullif(btrim(category_value), '') is not null
    ),
    '{}'::text[]
  );
  normalized_notes text := nullif(btrim(game_notes), '');
  normalized_fingerprint text;
  submissions_this_hour integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_title is null then
    raise exception 'game_title is required';
  end if;

  if game_release_year is not null and (game_release_year < 1970 or game_release_year > 2100) then
    raise exception 'game_release_year must be between 1970 and 2100';
  end if;

  if coalesce(array_length(normalized_categories, 1), 0) = 0 then
    normalized_categories = public.infer_game_categories(
      normalized_title,
      normalized_manufacturer,
      normalized_aliases
    );
  end if;

  select private.game_submission_fingerprint(
    normalized_title,
    normalized_manufacturer,
    game_release_year
  )
  into normalized_fingerprint;

  if exists (
    select 1
    from public.game_submissions gs
    where
      gs.submitted_by = current_user_id
      and gs.submission_fingerprint = normalized_fingerprint
      and gs.status = 'pending'
  ) then
    raise exception 'You already submitted this game for review.';
  end if;

  select count(*)
  into submissions_this_hour
  from public.game_submissions gs
  where
    gs.submitted_by = current_user_id
    and gs.created_at >= timezone('utc'::text, now()) - interval '1 hour';

  if submissions_this_hour >= 20 then
    raise exception 'Game submission limit reached. Try again later.';
  end if;

  return query
  insert into public.game_submissions (
    submitted_by,
    title,
    manufacturer,
    release_year,
    aliases,
    categories,
    notes,
    submission_fingerprint
  )
  values (
    current_user_id,
    normalized_title,
    normalized_manufacturer,
    game_release_year,
    normalized_aliases,
    normalized_categories,
    normalized_notes,
    normalized_fingerprint
  )
  returning
    game_submissions.id,
    game_submissions.status;
end;
$$;
