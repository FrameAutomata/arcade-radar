create policy "admins_can_insert_games"
on public.games
for insert
to authenticated
with check (private.has_admin_access());

create or replace function public.create_game(
  game_title text,
  game_manufacturer text default null,
  game_release_year integer default null,
  game_aliases text[] default '{}'
)
returns table (
  created_game_id uuid,
  created_game_slug text,
  created_game_title text,
  created_game_manufacturer text,
  created_game_release_year integer,
  created_game_aliases text[]
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
    aliases
  )
  values (
    final_slug,
    normalized_title,
    normalized_manufacturer,
    game_release_year,
    normalized_aliases
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
    resulting_game.aliases;
end;
$$;

revoke execute on function public.create_game(text, text, integer, text[]) from public, anon;
grant execute on function public.create_game(text, text, integer, text[]) to authenticated;
