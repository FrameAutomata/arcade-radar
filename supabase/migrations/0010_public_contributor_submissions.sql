create table if not exists public.venue_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  street_address text,
  city text not null,
  region text not null,
  postal_code text,
  country text not null default 'US',
  latitude double precision not null,
  longitude double precision not null,
  website text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  approved_venue_id uuid references public.venues(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.game_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  manufacturer text,
  release_year integer,
  aliases text[] not null default '{}',
  categories text[] not null default '{}',
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  approved_game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint game_submissions_release_year_check
    check (release_year is null or (release_year >= 1970 and release_year <= 2100))
);

create trigger set_venue_submissions_updated_at
before update on public.venue_submissions
for each row execute function public.set_updated_at();

create trigger set_game_submissions_updated_at
before update on public.game_submissions
for each row execute function public.set_updated_at();

alter table public.venue_submissions enable row level security;
alter table public.game_submissions enable row level security;

drop policy if exists "scouts_can_create_inventory_reports"
on public.inventory_reports;

create policy "authenticated_users_can_create_inventory_reports"
on public.inventory_reports
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "contributors_can_create_venue_submissions"
on public.venue_submissions
for insert
to authenticated
with check ((select auth.uid()) = submitted_by);

create policy "contributors_can_read_own_venue_submissions_and_admins_read_all"
on public.venue_submissions
for select
to authenticated
using (
  (select auth.uid()) = submitted_by
  or private.has_admin_access()
);

create policy "admins_can_update_venue_submissions"
on public.venue_submissions
for update
to authenticated
using (private.has_admin_access())
with check (private.has_admin_access());

create policy "contributors_can_create_game_submissions"
on public.game_submissions
for insert
to authenticated
with check ((select auth.uid()) = submitted_by);

create policy "contributors_can_read_own_game_submissions_and_admins_read_all"
on public.game_submissions
for select
to authenticated
using (
  (select auth.uid()) = submitted_by
  or private.has_admin_access()
);

create policy "admins_can_update_game_submissions"
on public.game_submissions
for update
to authenticated
using (private.has_admin_access())
with check (private.has_admin_access());

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
    notes
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
    normalized_notes
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

  return query
  insert into public.game_submissions (
    submitted_by,
    title,
    manufacturer,
    release_year,
    aliases,
    categories,
    notes
  )
  values (
    current_user_id,
    normalized_title,
    normalized_manufacturer,
    game_release_year,
    normalized_aliases,
    normalized_categories,
    normalized_notes
  )
  returning
    game_submissions.id,
    game_submissions.status;
end;
$$;

create or replace function public.list_pending_venue_submissions(
  result_limit integer default 50
)
returns table (
  submission_id uuid,
  submitted_by uuid,
  name text,
  street_address text,
  city text,
  region text,
  postal_code text,
  country text,
  latitude double precision,
  longitude double precision,
  website text,
  notes text,
  created_at timestamptz
)
set search_path = public, extensions
language plpgsql
stable
security invoker
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
  end if;

  return query
  select
    vs.id,
    vs.submitted_by,
    vs.name,
    vs.street_address,
    vs.city,
    vs.region,
    vs.postal_code,
    vs.country,
    vs.latitude,
    vs.longitude,
    vs.website,
    vs.notes,
    vs.created_at
  from public.venue_submissions vs
  where vs.status = 'pending'
  order by vs.created_at desc
  limit greatest(result_limit, 1);
end;
$$;

create or replace function public.list_pending_game_submissions(
  result_limit integer default 50
)
returns table (
  submission_id uuid,
  submitted_by uuid,
  title text,
  manufacturer text,
  release_year integer,
  aliases text[],
  categories text[],
  notes text,
  created_at timestamptz
)
set search_path = public, extensions
language plpgsql
stable
security invoker
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
  end if;

  return query
  select
    gs.id,
    gs.submitted_by,
    gs.title,
    gs.manufacturer,
    gs.release_year,
    gs.aliases,
    gs.categories,
    gs.notes,
    gs.created_at
  from public.game_submissions gs
  where gs.status = 'pending'
  order by gs.created_at desc
  limit greatest(result_limit, 1);
end;
$$;

create or replace function public.approve_venue_submission(
  selected_submission_id uuid
)
returns table (
  submission_id uuid,
  created_venue_id uuid,
  created_venue_slug text,
  created_venue_name text
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
  submission_row public.venue_submissions%rowtype;
  generated_slug text;
  final_slug text;
  resulting_venue public.venues%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
  end if;

  select *
  into submission_row
  from public.venue_submissions vs
  where vs.id = selected_submission_id
  for update;

  if not found then
    raise exception 'Venue submission not found';
  end if;

  if submission_row.status <> 'pending' then
    raise exception 'Venue submission has already been reviewed';
  end if;

  select private.slugify_text(submission_row.name) into generated_slug;

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
    submission_row.name,
    submission_row.street_address,
    submission_row.city,
    submission_row.region,
    submission_row.postal_code,
    submission_row.country,
    'contributor',
    'active',
    extensions.st_setsrid(
      extensions.st_makepoint(submission_row.longitude, submission_row.latitude),
      4326
    )::extensions.geography,
    jsonb_strip_nulls(
      jsonb_build_object(
        'website', submission_row.website,
        'notes', submission_row.notes,
        'submitted_by', submission_row.submitted_by
      )
    )
  )
  returning *
  into resulting_venue;

  update public.venue_submissions
  set
    status = 'approved',
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = current_user_id,
    approved_venue_id = resulting_venue.id,
    review_notes = null
  where id = submission_row.id;

  return query
  select
    submission_row.id,
    resulting_venue.id,
    resulting_venue.slug,
    resulting_venue.name;
end;
$$;

create or replace function public.reject_venue_submission(
  selected_submission_id uuid,
  rejection_reason text default null
)
returns table (
  submission_id uuid,
  submission_status text,
  reviewed_at timestamptz
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
  end if;

  return query
  update public.venue_submissions
  set
    status = 'rejected',
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = current_user_id,
    review_notes = nullif(btrim(rejection_reason), '')
  where
    id = selected_submission_id
    and status = 'pending'
  returning
    venue_submissions.id,
    venue_submissions.status,
    venue_submissions.reviewed_at;

  if not found then
    raise exception 'Pending venue submission not found';
  end if;
end;
$$;

create or replace function public.approve_game_submission(
  selected_submission_id uuid
)
returns table (
  submission_id uuid,
  created_game_id uuid,
  created_game_slug text,
  created_game_title text
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
  submission_row public.game_submissions%rowtype;
  generated_slug text;
  final_slug text;
  resulting_game public.games%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
  end if;

  select *
  into submission_row
  from public.game_submissions gs
  where gs.id = selected_submission_id
  for update;

  if not found then
    raise exception 'Game submission not found';
  end if;

  if submission_row.status <> 'pending' then
    raise exception 'Game submission has already been reviewed';
  end if;

  select private.slugify_text(submission_row.title) into generated_slug;

  if generated_slug is null or generated_slug = '' then
    raise exception 'Could not generate a slug for this game';
  end if;

  final_slug := generated_slug;

  if exists (select 1 from public.games where slug = final_slug) then
    final_slug := final_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  insert into public.games (
    slug,
    title,
    manufacturer,
    release_year,
    aliases,
    categories
  )
  values (
    final_slug,
    submission_row.title,
    submission_row.manufacturer,
    submission_row.release_year,
    submission_row.aliases,
    submission_row.categories
  )
  returning *
  into resulting_game;

  update public.game_submissions
  set
    status = 'approved',
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = current_user_id,
    approved_game_id = resulting_game.id,
    review_notes = null
  where id = submission_row.id;

  return query
  select
    submission_row.id,
    resulting_game.id,
    resulting_game.slug,
    resulting_game.title;
end;
$$;

create or replace function public.reject_game_submission(
  selected_submission_id uuid,
  rejection_reason text default null
)
returns table (
  submission_id uuid,
  submission_status text,
  reviewed_at timestamptz
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
  end if;

  return query
  update public.game_submissions
  set
    status = 'rejected',
    reviewed_at = timezone('utc'::text, now()),
    reviewed_by = current_user_id,
    review_notes = nullif(btrim(rejection_reason), '')
  where
    id = selected_submission_id
    and status = 'pending'
  returning
    game_submissions.id,
    game_submissions.status,
    game_submissions.reviewed_at;

  if not found then
    raise exception 'Pending game submission not found';
  end if;
end;
$$;

revoke execute on function public.submit_venue_submission(text, text, text, text, text, text, double precision, double precision, text, text) from public, anon;
grant execute on function public.submit_venue_submission(text, text, text, text, text, text, double precision, double precision, text, text) to authenticated;

revoke execute on function public.submit_game_submission(text, text, integer, text[], text[], text) from public, anon;
grant execute on function public.submit_game_submission(text, text, integer, text[], text[], text) to authenticated;

revoke execute on function public.list_pending_venue_submissions(integer) from public, anon;
grant execute on function public.list_pending_venue_submissions(integer) to authenticated;

revoke execute on function public.list_pending_game_submissions(integer) from public, anon;
grant execute on function public.list_pending_game_submissions(integer) to authenticated;

revoke execute on function public.approve_venue_submission(uuid) from public, anon;
grant execute on function public.approve_venue_submission(uuid) to authenticated;

revoke execute on function public.reject_venue_submission(uuid, text) from public, anon;
grant execute on function public.reject_venue_submission(uuid, text) to authenticated;

revoke execute on function public.approve_game_submission(uuid) from public, anon;
grant execute on function public.approve_game_submission(uuid) to authenticated;

revoke execute on function public.reject_game_submission(uuid, text) from public, anon;
grant execute on function public.reject_game_submission(uuid, text) to authenticated;
