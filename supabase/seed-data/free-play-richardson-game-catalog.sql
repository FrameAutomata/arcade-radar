-- Free Play Richardson pre-scout game catalog seed.
--
-- Purpose:
--   Make Scout Mode game search useful before an on-site inventory pass.
--   This inserts/updates games only. It does not mark these games as confirmed
--   inventory for Free Play Richardson.
--
-- Public sources used while preparing this list:
--   https://freeplayinc.com/richardson/
--   https://zenius-i-vanisher.com/v5.2/arcade.php?id=4855
--   https://www.kineticist.com/locations/free-play-richardson
--   https://pinside.com/pinball/map/where-to-play/8661-free-play-arcade-richardson-richardson-tx
--   https://dallas.culturemap.com/news/entertainment/07-30-15-free-play-arcade-retro-games-richardson/

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
  ('dance-dance-revolution-supernova', 'DanceDanceRevolution SuperNOVA', 'Konami', 2006, array['DDR SuperNOVA', 'DDR Supernova'], array['Rhythm']),
  ('jubeat-ave', 'jubeat Ave.', 'Konami', 2022, array['Jubeat Ave', 'jubeat'], array['Rhythm']),
  ('museca', 'MUSECA', 'Konami', 2015, array['MÚSECA'], array['Rhythm']),
  ('sound-voltex-exceed-gear', 'SOUND VOLTEX EXCEED GEAR', 'Konami', 2021, array['SDVX', 'Sound Voltex', 'Exceed Gear'], array['Rhythm']),
  ('wacca-reverse', 'WACCA REVERSE', 'Marvelous', 2021, array['WACCA'], array['Rhythm']),
  ('bubbles', 'Bubbles', 'Williams', 1982, array['Bubbles Arcade'], array['Classic']),
  ('centipede', 'Centipede', 'Atari', 1981, array['Centipede Arcade'], array['Classic']),
  ('crazy-taxi', 'Crazy Taxi', 'Sega', 1999, array['Crazy Taxi Arcade'], array['Racing']),
  ('crystal-castles', 'Crystal Castles', 'Atari', 1983, array['Crystal Castles Arcade'], array['Classic']),
  ('dig-dug', 'Dig Dug', 'Namco', 1982, array['Dig Dug Arcade'], array['Classic']),
  ('frogger', 'Frogger', 'Konami', 1981, array['Frogger Arcade'], array['Classic']),
  ('gauntlet', 'Gauntlet', 'Atari Games', 1985, array['Gauntlet Arcade'], array['Beat em up']),
  ('gauntlet-dark-legacy', 'Gauntlet Dark Legacy', 'Midway', 1999, array['Dark Legacy'], array['Beat em up']),
  ('rampage', 'Rampage', 'Bally Midway', 1986, array['Rampage Arcade'], array['Beat em up']),
  ('tapper', 'Tapper', 'Bally Midway', 1983, array['Root Beer Tapper', 'Budweiser Tapper'], array['Classic']),
  ('tempest', 'Tempest', 'Atari', 1981, array['Tempest Arcade'], array['Classic']),
  ('major-havoc', 'The Adventures of Major Havoc', 'Atari', 1983, array['Major Havoc'], array['Classic']),
  ('tron', 'Tron', 'Bally Midway', 1982, array['TRON'], array['Classic']),
  ('alien-vs-predator', 'Alien vs. Predator', 'Capcom', 1994, array['Alien Vs. Predator', 'AvP'], array['Beat em up']),
  ('dungeons-and-dragons-shadow-over-mystara', 'Dungeons & Dragons: Shadow over Mystara', 'Capcom', 1996, array['D&D Shadow over Mystara', 'Shadow over Mystara'], array['Beat em up']),
  ('final-fight', 'Final Fight', 'Capcom', 1989, array['Final Fight Arcade'], array['Beat em up']),
  ('michael-jacksons-moonwalker', 'Michael Jackson''s Moonwalker', 'Sega', 1990, array['Moonwalker'], array['Beat em up']),
  ('teenage-mutant-ninja-turtles', 'Teenage Mutant Ninja Turtles', 'Konami', 1989, array['TMNT', 'TMNT Arcade'], array['Beat em up']),
  ('the-simpsons-arcade-game', 'The Simpsons Arcade Game', 'Konami', 1991, array['The Simpsons', 'Simpsons Arcade'], array['Beat em up']),
  ('dragon-ball-z-2-super-battle', 'Dragon Ball Z 2: Super Battle', 'Banpresto', 1994, array['DBZ 2 Super Battle'], array['Fighting']),
  ('killer-instinct', 'Killer Instinct', 'Midway', 1994, array['KI1', 'Killer Instinct 1'], array['Fighting']),
  ('marvel-vs-capcom-clash-of-super-heroes', 'Marvel vs. Capcom: Clash of Super Heroes', 'Capcom', 1998, array['MVC1', 'Marvel vs Capcom 1'], array['Fighting']),
  ('mortal-kombat-ii', 'Mortal Kombat II', 'Midway', 1993, array['MK2', 'Mortal Kombat 2'], array['Fighting']),
  ('punch-out', 'Punch-Out!!', 'Nintendo', 1984, array['Punch-Out', 'Punch Out'], array['Sports']),
  ('street-fighter-alpha-2', 'Street Fighter Alpha 2', 'Capcom', 1996, array['SFA2', 'Alpha 2'], array['Fighting']),
  ('super-street-fighter-ii-turbo', 'Super Street Fighter II Turbo', 'Capcom', 1994, array['ST', 'Super Turbo', 'SSF2T'], array['Fighting']),
  ('ultra-street-fighter-iv', 'Ultra Street Fighter IV', 'Capcom', 2014, array['USF4', 'Ultra SF4'], array['Fighting']),
  ('defender', 'Defender', 'Williams', 1981, array['Defender Arcade'], array['Classic', 'Shooter']),
  ('skycurser', 'SkyCurser', 'Griffin Aerotech', 2017, array['Sky Curser'], array['Shooter']),
  ('dragons-lair', 'Dragon''s Lair', 'Cinematronics', 1983, array['Dragons Lair'], array['Classic']),
  ('baby-pac-man', 'Baby Pac-Man', 'Bally Midway', 1982, array['Baby Pac Man'], array['Classic']),
  ('eyes', 'Eyes', 'Rock-Ola', 1982, array['Eyes Arcade'], array['Classic']),
  ('lady-bug', 'Lady Bug', 'Universal', 1981, array['Ladybug'], array['Classic']),
  ('ms-pac-man', 'Ms. Pac-Man', 'Bally Midway', 1982, array['Ms Pac Man', 'Miss Pac Man'], array['Classic']),
  ('nibbler', 'Nibbler', 'Rock-Ola', 1982, array['Nibbler Arcade'], array['Classic']),
  ('pac-man', 'Pac-Man', 'Namco', 1980, array['Pac Man'], array['Classic']),
  ('pac-man-battle-royale', 'Pac-Man Battle Royale', 'Namco Bandai', 2011, array['Pac Man Battle Royale'], array['Classic']),
  ('asteroids-deluxe', 'Asteroids Deluxe', 'Atari', 1981, array['Asteroids Deluxe Arcade'], array['Classic', 'Shooter']),
  ('robotron-2084', 'Robotron: 2084', 'Williams', 1982, array['Robotron', 'Robotron 2084'], array['Classic', 'Shooter']),
  ('sinistar', 'Sinistar', 'Williams', 1983, array['Sinistar Arcade'], array['Classic', 'Shooter']),
  ('smash-tv', 'Smash TV', 'Williams', 1990, array['Smash T.V.', 'SmashTV'], array['Shooter']),
  ('ataxx', 'Ataxx', 'Leland', 1990, array['Ataxx Arcade'], array['Puzzle']),
  ('ice-cold-beer', 'Ice Cold Beer', 'Taito', 1983, array['Ice Cold Beer Arcade'], array['Classic']),
  ('nintendo-playchoice-10', 'Nintendo PlayChoice-10', 'Nintendo', 1986, array['PlayChoice-10', 'PlayChoice 10'], array['Classic']),
  ('sega-mega-tech', 'Sega Mega-Tech', 'Sega', 1989, array['Mega-Tech', 'Mega Tech'], array['Classic']),
  ('attack-from-mars', 'Attack from Mars', 'Bally', 1995, array['AFM'], array['Pinball']),
  ('black-knight-sword-of-rage', 'Black Knight: Sword of Rage', 'Stern', 2019, array['Black Knight Sword of Rage', 'BKSOR'], array['Pinball']),
  ('creature-from-the-black-lagoon', 'Creature from the Black Lagoon', 'Bally', 1992, array['Creature from the Black Lagoon Pinball'], array['Pinball']),
  ('deadpool-pro', 'Deadpool (Pro)', 'Stern', 2018, array['Deadpool Pinball'], array['Pinball']),
  ('foo-fighters-pro', 'Foo Fighters (Pro)', 'Stern', 2023, array['Foo Fighters Pinball'], array['Pinball']),
  ('granny-and-the-gators', 'Granny and the Gators', 'Bally Midway', 1984, array['Granny and the Gators Pinball'], array['Pinball']),
  ('guardians-of-the-galaxy-pinball', 'Guardians of the Galaxy', 'Stern', 2017, array['Guardians Pinball', 'GOTG Pinball'], array['Pinball']),
  ('iron-maiden-legacy-of-the-beast', 'Iron Maiden: Legacy of the Beast', 'Stern', 2018, array['Iron Maiden Pinball', 'Iron Maiden LOTB'], array['Pinball']),
  ('jaws-pro', 'JAWS (Pro)', 'Stern', 2024, array['Jaws Pinball'], array['Pinball']),
  ('medieval-madness', 'Medieval Madness', 'Williams', 1997, array['Medieval Madness Remake'], array['Pinball']),
  ('monster-bash', 'Monster Bash', 'Williams', 1998, array['Monster Bash Remake'], array['Pinball']),
  ('revenge-from-mars', 'Revenge from Mars', 'Bally', 1999, array['Revenge from Mars In 3D'], array['Pinball']),
  ('rush-premium', 'Rush (Premium)', 'Stern', 2022, array['Rush Pinball'], array['Pinball']),
  ('the-lord-of-the-rings-pinball', 'The Lord of the Rings', 'Stern', 2003, array['Lord of the Rings Pinball', 'LOTR Pinball'], array['Pinball']),
  ('theatre-of-magic', 'Theatre of Magic', 'Bally', 1995, array['Theater of Magic'], array['Pinball']),
  ('total-nuclear-annihilation', 'Total Nuclear Annihilation', 'Spooky Pinball', 2017, array['TNA Pinball'], array['Pinball']),
  ('the-uncanny-x-men-pro', 'The Uncanny X-Men (Pro)', 'Stern', 2024, array['Uncanny X-Men Pinball', 'X-Men Pro'], array['Pinball']),
  ('black-tiger', 'Black Tiger', 'Capcom', 1987, array['Black Dragon'], array['Platformer']),
  ('donkey-kong', 'Donkey Kong', 'Nintendo', 1981, array['DK', 'Donkey Kong Arcade'], array['Classic', 'Platformer']),
  ('donkey-kong-3', 'Donkey Kong 3', 'Nintendo', 1983, array['DK3'], array['Classic', 'Platformer']),
  ('donkey-kong-jr', 'Donkey Kong Jr.', 'Nintendo', 1982, array['Donkey Kong Junior', 'DK Jr.'], array['Classic', 'Platformer']),
  ('ghosts-n-goblins', 'Ghosts''n Goblins', 'Capcom', 1985, array['Ghosts n Goblins'], array['Platformer']),
  ('joust', 'Joust', 'Williams', 1982, array['Joust Arcade'], array['Classic', 'Platformer']),
  ('mario-bros', 'Mario Bros.', 'Nintendo', 1983, array['Mario Bros'], array['Classic', 'Platformer']),
  ('rastan', 'Rastan', 'Taito', 1987, array['Rastan Saga'], array['Platformer']),
  ('columns', 'Columns', 'Sega', 1990, array['Columns Arcade'], array['Puzzle']),
  ('qbert', 'Q*bert', 'Gottlieb', 1982, array['Qbert', 'Q Bert'], array['Classic', 'Puzzle']),
  ('tetris', 'Tetris', 'Atari Games', 1988, array['Tetris Arcade'], array['Puzzle']),
  ('vs-dr-mario', 'Vs. Dr. Mario', 'Nintendo', 1990, array['Dr. Mario Arcade', 'Vs Dr Mario'], array['Puzzle']),
  ('daytona-usa', 'Daytona USA', 'Sega', 1994, array['Daytona USA 2P'], array['Racing']),
  ('hydro-thunder', 'Hydro Thunder', 'Midway', 1999, array['Hydro Thunder 2P'], array['Racing']),
  ('super-off-road', 'Ivan ''Ironman'' Stewart''s Super Off Road', 'Leland', 1989, array['Super Off Road', 'Ironman Stewart Super Off Road'], array['Racing']),
  ('marble-madness', 'Marble Madness', 'Atari Games', 1984, array['Marble Madness Arcade'], array['Racing']),
  ('race-drivin', 'Race Drivin''', 'Atari Games', 1990, array['Race Drivin'], array['Racing']),
  ('area-51', 'Area 51', 'Atari Games', 1995, array['Area 51 Arcade'], array['Light gun']),
  ('area-51-site-4', 'Area 51: Site 4', 'Atari Games', 1998, array['Site 4'], array['Light gun']),
  ('lucky-and-wild', 'Lucky & Wild', 'Namco', 1993, array['Lucky and Wild'], array['Light gun', 'Racing']),
  ('star-wars-1983', 'Star Wars', 'Atari', 1983, array['Star Wars 1983', 'Star Wars Arcade'], array['Classic', 'Shooter']),
  ('terminator-2-judgment-day-arcade', 'Terminator 2: Judgment Day', 'Midway', 1991, array['T2 Arcade', 'Terminator 2 Arcade'], array['Light gun']),
  ('time-crisis-3', 'Time Crisis 3', 'Namco', 2002, array['TC3', 'Time Crisis III'], array['Light gun']),
  ('zombie-raid', 'Zombie Raid', 'American Sammy', 1995, array['Zombie Raid Arcade'], array['Light gun']),
  ('berzerk', 'Berzerk', 'Stern', 1980, array['Berzerk Arcade'], array['Classic', 'Shooter']),
  ('galaga', 'Galaga', 'Namco', 1981, array['Galaga ''81'], array['Classic', 'Shooter']),
  ('gyruss', 'Gyruss', 'Konami', 1983, array['Gyruss Arcade'], array['Shooter']),
  ('moon-cresta', 'Moon Cresta', 'Nichibutsu', 1980, array['Moon Cresta Arcade'], array['Shooter']),
  ('roadblasters', 'RoadBlasters', 'Atari Games', 1987, array['Road Blasters'], array['Racing', 'Shooter']),
  ('satans-hollow', 'Satan''s Hollow', 'Bally Midway', 1982, array['Satans Hollow'], array['Shooter']),
  ('space-invaders', 'Space Invaders', 'Taito', 1978, array['Space Invaders Arcade'], array['Classic', 'Shooter']),
  ('viper-phase-1-usa', 'Viper Phase 1 USA', 'Seibu Kaihatsu', 1995, array['Viper Phase 1'], array['Shooter']),
  ('nba-maximum-hangtime', 'NBA Maximum Hangtime', 'Midway', 1996, array['NBA Hangtime', 'Maximum Hangtime'], array['Sports']),
  ('nfl-blitz', 'NFL Blitz', 'Midway', 1997, array['NFL Blitz Arcade'], array['Sports']),
  ('silver-strike-bowling-09', 'Silver Strike Bowling 2009', 'Incredible Technologies', 2008, array['Silver Strike Bowling ''09'], array['Sports']),
  ('rampart', 'Rampart', 'Atari Games', 1990, array['Rampart Arcade'], array['Strategy'])
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
