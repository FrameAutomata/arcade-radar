-- Safe cleanup for punctuation/title duplicates created during early MAME imports.
--
-- This merges aliases/categories/external IDs into the canonical game row, then
-- deletes the duplicate row only when it is not referenced by live inventory or
-- inventory reports.

with duplicate_pairs(duplicate_slug, canonical_slug) as (
  values
    ('dragon-s-lair', 'dragons-lair'),
    ('q-bert', 'qbert'),
    ('road-blasters', 'roadblasters'),
    ('satan-s-hollow', 'satans-hollow'),
    ('smash-t-v', 'smash-tv'),
    ('soul-calibur', 'soulcalibur'),
    ('soul-calibur-ii', 'soulcalibur-ii'),
    ('star-wars', 'star-wars-1983'),
    ('terminator-2-judgment-day', 'terminator-2-judgment-day-arcade'),
    ('the-house-of-the-dead-2', 'house-of-the-dead-2')
),
matched_pairs as (
  select
    duplicate_pairs.duplicate_slug,
    duplicate_pairs.canonical_slug,
    duplicate_game.id as duplicate_id,
    canonical_game.id as canonical_id,
    duplicate_game.aliases as duplicate_aliases,
    duplicate_game.categories as duplicate_categories,
    duplicate_game.external_ids as duplicate_external_ids,
    duplicate_game.metadata as duplicate_metadata
  from duplicate_pairs
  join public.games duplicate_game on duplicate_game.slug = duplicate_pairs.duplicate_slug
  join public.games canonical_game on canonical_game.slug = duplicate_pairs.canonical_slug
)
update public.games canonical_game
set
  aliases = (
    select array(
      select distinct alias_value
      from unnest(coalesce(canonical_game.aliases, '{}'::text[]) || matched_pairs.duplicate_aliases) as merged_aliases(alias_value)
      where alias_value <> ''
      order by alias_value
    )
  ),
  categories = (
    select array(
      select distinct category_value
      from unnest(coalesce(canonical_game.categories, '{}'::text[]) || matched_pairs.duplicate_categories) as merged_categories(category_value)
      where category_value <> ''
      order by category_value
    )
  ),
  external_ids = jsonb_set(
    coalesce(canonical_game.external_ids, '{}'::jsonb) || (matched_pairs.duplicate_external_ids - 'mame'),
    '{mame}',
    (
      select to_jsonb(array(
        select distinct mame_id
        from jsonb_array_elements_text(coalesce(canonical_game.external_ids -> 'mame', '[]'::jsonb) || coalesce(matched_pairs.duplicate_external_ids -> 'mame', '[]'::jsonb)) as merged_mame_ids(mame_id)
        order by mame_id
      ))
    ),
    true
  ),
  metadata = coalesce(canonical_game.metadata, '{}'::jsonb) || matched_pairs.duplicate_metadata
from matched_pairs
where canonical_game.id = matched_pairs.canonical_id;

with duplicate_pairs(duplicate_slug, canonical_slug) as (
  values
    ('dragon-s-lair', 'dragons-lair'),
    ('q-bert', 'qbert'),
    ('road-blasters', 'roadblasters'),
    ('satan-s-hollow', 'satans-hollow'),
    ('smash-t-v', 'smash-tv'),
    ('soul-calibur', 'soulcalibur'),
    ('soul-calibur-ii', 'soulcalibur-ii'),
    ('star-wars', 'star-wars-1983'),
    ('terminator-2-judgment-day', 'terminator-2-judgment-day-arcade'),
    ('the-house-of-the-dead-2', 'house-of-the-dead-2')
)
delete from public.games duplicate_game
using duplicate_pairs
where
  duplicate_game.slug = duplicate_pairs.duplicate_slug
  and not exists (
    select 1
    from public.venue_games venue_game
    where venue_game.game_id = duplicate_game.id
  )
  and not exists (
    select 1
    from public.inventory_reports inventory_report
    where inventory_report.game_id = duplicate_game.id
  );
