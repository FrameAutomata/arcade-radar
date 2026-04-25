create or replace function public.infer_game_categories(
  game_title text,
  game_manufacturer text default null,
  game_aliases text[] default '{}'
)
returns text[]
language sql
immutable
as $$
  with game_text as (
    select lower(
      coalesce(game_title, '') || ' ' ||
      coalesce(game_manufacturer, '') || ' ' ||
      coalesce(array_to_string(game_aliases, ' '), '')
    ) as value
  ),
  inferred_categories as (
    select unnest(array[
      case
        when value ~ '(street fighter|tekken|mortal kombat|marvel vs|king of fighters|guilty gear|soulcalibur|killer instinct|virtua fighter|blazblue|darkstalkers)'
          then 'Fighting'
      end,
      case
        when value ~ '(dance dance|ddr|beatmania|pop.?n|taiko|jubeat|sound voltex|groove coaster|maimai|pump it up|rhythm)'
          then 'Rhythm'
      end,
      case
        when value ~ '(time crisis|house of the dead|area 51|terminator|jurassic park|deadstorm|ghost squad|light gun|shooting gallery)'
          then 'Light gun'
      end,
      case
        when value ~ '(daytona|cruis.?n|mario kart|initial d|outrun|ridge racer|sega rally|hydro thunder|racing|driver)'
          then 'Racing'
      end,
      case
        when value ~ '(pinball|stern|bally|williams pinball|data east pinball|gottlieb)'
          then 'Pinball'
      end,
      case
        when value ~ '(pac-man|galaga|donkey kong|centipede|asteroids|frogger|dig dug|q\\*bert|defender|classic)'
          then 'Classic'
      end,
      case
        when value ~ '(nba jam|nfl blitz|golden tee|track & field|virtua tennis|sports)'
          then 'Sports'
      end,
      case
        when value ~ '(claw|prize|ticket|redemption|skee-ball|whac|down the clown)'
          then 'Redemption'
      end,
      case
        when value ~ '(beat.?em|final fight|simpsons|x-men|turtles|tmnt|streets of rage|gauntlet)'
          then 'Beat em up'
      end,
      case
        when value ~ '(shmup|shoot.?em|raiden|1942|rtype|r-type|dodonpachi|ikaruga|metal slug)'
          then 'Shooter'
      end
    ]) as category
    from game_text
  )
  select coalesce(
    array_agg(distinct category order by category)
      filter (where category is not null),
    array['Arcade']
  )
  from inferred_categories;
$$;

alter table public.games
add column if not exists categories text[] not null default '{}';

update public.games
set categories = public.infer_game_categories(title, manufacturer, aliases)
where coalesce(array_length(categories, 1), 0) = 0;

create index if not exists games_categories_gin_idx
  on public.games using gin (categories);

create or replace function public.set_game_search_text()
returns trigger
language plpgsql
as $$
begin
  if coalesce(array_length(new.categories, 1), 0) = 0 then
    new.categories = public.infer_game_categories(
      new.title,
      new.manufacturer,
      new.aliases
    );
  end if;

  new.search_text = lower(
    btrim(
      coalesce(new.title, '') || ' ' ||
      coalesce(new.manufacturer, '') || ' ' ||
      coalesce(array_to_string(new.aliases, ' '), '') || ' ' ||
      coalesce(array_to_string(new.categories, ' '), '')
    )
  );

  return new;
end;
$$;

update public.games
set updated_at = updated_at;

drop function if exists public.search_games(text, integer);

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
  categories text[],
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
    g.categories,
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
    or exists (
      select 1
      from unnest(g.categories) category
      where lower(category) like '%' || lower(search_query) || '%'
    )
  order by
    case when lower(g.title) = lower(search_query) then 0 else 1 end,
    case when lower(g.title) like lower(search_query) || '%' then 0 else 1 end,
    similarity_score desc,
    g.title asc
  limit greatest(result_limit, 1);
$$;

drop function if exists public.get_venue_details(uuid);

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
  categories text[],
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
    g.categories,
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

drop function if exists public.create_game(text, text, integer, text[]);

create or replace function public.create_game(
  game_title text,
  game_manufacturer text default null,
  game_release_year integer default null,
  game_aliases text[] default '{}',
  game_categories text[] default '{}'
)
returns table (
  created_game_id uuid,
  created_game_slug text,
  created_game_title text,
  created_game_manufacturer text,
  created_game_release_year integer,
  created_game_aliases text[],
  created_game_categories text[]
)
set search_path = public, extensions
language plpgsql
security invoker
as $$
declare
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
  generated_slug text;
  final_slug text;
  resulting_game public.games%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.has_admin_access() then
    raise exception 'Admin access is required';
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

  select private.slugify_text(normalized_title) into generated_slug;

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
    normalized_title,
    normalized_manufacturer,
    game_release_year,
    normalized_aliases,
    normalized_categories
  )
  returning *
  into resulting_game;

  return query
  select
    resulting_game.id,
    resulting_game.slug,
    resulting_game.title,
    resulting_game.manufacturer,
    resulting_game.release_year,
    resulting_game.aliases,
    resulting_game.categories;
end;
$$;

revoke execute on function public.create_game(text, text, integer, text[], text[]) from public, anon;
grant execute on function public.create_game(text, text, integer, text[], text[]) to authenticated;
