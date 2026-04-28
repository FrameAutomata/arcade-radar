-- Arcade 92 McKinney pre-scout game catalog seed.
--
-- Purpose:
--   Make Scout Mode game search useful for a same-day Arcade 92 McKinney
--   scouting pass. This inserts/updates games only. It does not mark these
--   games as confirmed inventory for Arcade 92 McKinney.
--
-- Public sources used while preparing this list:
--   https://www.arcade92.com/mckinney/legends-never-die-blog-mckinney
--   https://pinside.com/pinball/map/where-to-play/14345-arcade92-retro-gaming-bar-mckinney-tx
--   https://www.restaurantji.com/tx/mckinney/arcade92-retro-arcade-bar-kitchen-/
--   https://www.arcade92.com/post/unleashing-the-roar-exploring-the-epic-tale-of-godzilla-pinball-at-arcade-92
--   https://www.arcade92.com/post/mortal-kombat-the-game-that-changed-the-arcade-scene-forever-at-arcade-92
--   https://www.arcade92.com/post/high-impact-football-arcade-gridiron-glory-at-arcade-92
--   https://www.arcade92.com/post/the-story-behind-the-92-in-arcade-92

begin;

insert into public.games as g (
  slug,
  title,
  manufacturer,
  release_year,
  aliases,
  categories
)
values
  -- Pinball listed for Arcade92 Retro Gaming Bar on Pinside.
  ('black-knight-sword-of-rage-pro', 'Black Knight: Sword of Rage (Pro)', 'Stern', 2019, array['Black Knight Sword of Rage', 'BKSOR'], array['Pinball']),
  ('dungeons-and-dragons-the-tyrants-eye-pro', 'Dungeons & Dragons: The Tyrant''s Eye (Pro)', 'Stern', 2025, array['D&D The Tyrant''s Eye', 'Dungeons and Dragons The Tyrants Eye'], array['Pinball']),
  ('foo-fighters-pro', 'Foo Fighters (Pro)', 'Stern', 2023, array['Foo Fighters Pinball'], array['Pinball']),
  ('godzilla-pro', 'Godzilla (Pro)', 'Stern', 2021, array['Godzilla Pinball'], array['Pinball']),
  ('guardians-of-the-galaxy-pro', 'Guardians of the Galaxy (Pro)', 'Stern', 2017, array['Guardians Pinball', 'GOTG Pinball'], array['Pinball']),
  ('iron-maiden-legacy-of-the-beast-pro', 'Iron Maiden: Legacy of the Beast (Pro)', 'Stern', 2018, array['Iron Maiden Pinball', 'Iron Maiden LOTB'], array['Pinball']),
  ('james-bond-007-pro', 'James Bond 007 (Pro)', 'Stern', 2022, array['James Bond Pinball', '007 Pinball'], array['Pinball']),
  ('jaws-pro', 'JAWS (Pro)', 'Stern', 2024, array['Jaws Pinball'], array['Pinball']),
  ('stranger-things-pro', 'Stranger Things (Pro)', 'Stern', 2019, array['Stranger Things Pinball'], array['Pinball']),
  ('the-uncanny-x-men-pro', 'The Uncanny X-Men (Pro)', 'Stern', 2024, array['Uncanny X-Men Pinball', 'X-Men Pro'], array['Pinball']),
  ('venom-pro', 'Venom (Pro)', 'Stern', 2023, array['Venom Pinball'], array['Pinball']),

  -- Games explicitly called out by Arcade 92/nearby public listings.
  ('pac-man', 'Pac-Man', 'Namco', 1980, array['Pac Man'], array['Classic']),
  ('qbert', 'Q*bert', 'Gottlieb', 1982, array['Qbert', 'Q Bert'], array['Classic', 'Puzzle']),
  ('asteroids', 'Asteroids', 'Atari', 1979, array['Asteroids Arcade'], array['Classic', 'Shooter']),
  ('vs-super-mario-bros', 'Vs. Super Mario Bros.', 'Nintendo', 1986, array['Super Mario Bros Arcade', 'VS Super Mario Bros'], array['Platformer']),
  ('mortal-kombat', 'Mortal Kombat', 'Midway', 1992, array['MK1', 'Mortal Kombat 1'], array['Fighting']),
  ('mortal-kombat-ii', 'Mortal Kombat II', 'Midway', 1993, array['MK2', 'Mortal Kombat 2'], array['Fighting']),
  ('ultimate-mortal-kombat-3', 'Ultimate Mortal Kombat 3', 'Midway', 1995, array['UMK3'], array['Fighting']),
  ('street-fighter-ii-the-world-warrior', 'Street Fighter II: The World Warrior', 'Capcom', 1991, array['Street Fighter II', 'SF2', 'Street Fighter 2'], array['Fighting']),
  ('street-fighter-ii-champion-edition', 'Street Fighter II'': Champion Edition', 'Capcom', 1992, array['Champion Edition', 'SF2 CE', 'Street Fighter 2 Champion Edition'], array['Fighting']),
  ('super-street-fighter-ii-turbo', 'Super Street Fighter II Turbo', 'Capcom', 1994, array['ST', 'Super Turbo', 'SSF2T'], array['Fighting']),
  ('nba-jam', 'NBA Jam', 'Midway', 1993, array['NBA Jam Arcade'], array['Sports']),

  -- High-probability retro/family titles to make lunch scouting faster.
  ('ms-pac-man', 'Ms. Pac-Man', 'Bally Midway', 1982, array['Ms Pac Man', 'Miss Pac Man'], array['Classic']),
  ('galaga', 'Galaga', 'Namco', 1981, array['Galaga ''81'], array['Classic', 'Shooter']),
  ('donkey-kong', 'Donkey Kong', 'Nintendo', 1981, array['DK', 'Donkey Kong Arcade'], array['Classic', 'Platformer']),
  ('donkey-kong-jr', 'Donkey Kong Jr.', 'Nintendo', 1982, array['Donkey Kong Junior', 'DK Jr.'], array['Classic', 'Platformer']),
  ('frogger', 'Frogger', 'Konami', 1981, array['Frogger Arcade'], array['Classic']),
  ('centipede', 'Centipede', 'Atari', 1981, array['Centipede Arcade'], array['Classic']),
  ('dig-dug', 'Dig Dug', 'Namco', 1982, array['Dig Dug Arcade'], array['Classic']),
  ('defender', 'Defender', 'Williams', 1981, array['Defender Arcade'], array['Classic', 'Shooter']),
  ('robotron-2084', 'Robotron: 2084', 'Williams', 1982, array['Robotron', 'Robotron 2084'], array['Classic', 'Shooter']),
  ('joust', 'Joust', 'Williams', 1982, array['Joust Arcade'], array['Classic', 'Platformer']),
  ('tempest', 'Tempest', 'Atari', 1981, array['Tempest Arcade'], array['Classic']),
  ('tetris', 'Tetris', 'Atari Games', 1988, array['Tetris Arcade'], array['Puzzle']),
  ('the-simpsons-arcade-game', 'The Simpsons Arcade Game', 'Konami', 1991, array['The Simpsons', 'Simpsons Arcade'], array['Beat em up']),
  ('teenage-mutant-ninja-turtles', 'Teenage Mutant Ninja Turtles', 'Konami', 1989, array['TMNT', 'TMNT Arcade'], array['Beat em up']),
  ('x-men', 'X-Men', 'Konami', 1992, array['X-Men Arcade'], array['Beat em up']),
  ('final-fight', 'Final Fight', 'Capcom', 1989, array['Final Fight Arcade'], array['Beat em up']),
  ('marvel-vs-capcom-clash-of-super-heroes', 'Marvel vs. Capcom: Clash of Super Heroes', 'Capcom', 1998, array['MVC1', 'Marvel vs Capcom 1'], array['Fighting']),
  ('marvel-vs-capcom-2', 'Marvel vs. Capcom 2', 'Capcom', 2000, array['MVC2', 'Marvel 2', 'Marvel vs Capcom 2'], array['Fighting']),
  ('tekken-3', 'Tekken 3', 'Namco', 1997, array['Tekken III'], array['Fighting']),
  ('killer-instinct', 'Killer Instinct', 'Midway', 1994, array['KI1', 'Killer Instinct 1'], array['Fighting']),
  ('time-crisis-2', 'Time Crisis 2', 'Namco', 1997, array['TC2', 'Time Crisis II'], array['Light gun']),
  ('area-51', 'Area 51', 'Atari Games', 1995, array['Area 51 Arcade'], array['Light gun']),
  ('house-of-the-dead-2', 'The House of the Dead 2', 'Sega', 1998, array['HOTD2', 'House of the Dead 2'], array['Light gun']),
  ('daytona-usa', 'Daytona USA', 'Sega', 1994, array['Daytona USA 2P'], array['Racing']),
  ('crazy-taxi', 'Crazy Taxi', 'Sega', 1999, array['Crazy Taxi Arcade'], array['Racing']),
  ('hydro-thunder', 'Hydro Thunder', 'Midway', 1999, array['Hydro Thunder 2P'], array['Racing']),
  ('nfl-blitz', 'NFL Blitz', 'Midway', 1997, array['NFL Blitz Arcade'], array['Sports'])
on conflict (slug) do update
set
  title = excluded.title,
  manufacturer = coalesce(g.manufacturer, excluded.manufacturer),
  release_year = coalesce(g.release_year, excluded.release_year),
  aliases = (
    select array(
      select distinct alias_value
      from unnest(coalesce(g.aliases, '{}'::text[]) || excluded.aliases) as merged_aliases(alias_value)
      where alias_value <> ''
      order by alias_value
    )
  ),
  categories = (
    select array(
      select distinct category_value
      from unnest(coalesce(g.categories, '{}'::text[]) || excluded.categories) as merged_categories(category_value)
      where category_value <> ''
      order by category_value
    )
  );

commit;
