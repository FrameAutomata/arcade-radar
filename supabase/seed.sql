insert into public.games (slug, title, manufacturer, release_year, aliases)
values
  ('street-fighter-iii-3rd-strike', 'Street Fighter III: 3rd Strike', 'Capcom', 1999, array['3rd Strike', 'SF3']),
  ('marvel-vs-capcom-2', 'Marvel vs. Capcom 2', 'Capcom', 2000, array['MVC2']),
  ('dance-dance-revolution-a20', 'DanceDanceRevolution A20', 'Konami', 2019, array['DDR', 'DDR A20']),
  ('time-crisis-2', 'Time Crisis 2', 'Namco', 1997, array['TC2']),
  ('killer-queen', 'Killer Queen', 'BumbleBear Games', 2013, array['KQ'])
on conflict (slug) do update
set
  title = excluded.title,
  manufacturer = excluded.manufacturer,
  release_year = excluded.release_year,
  aliases = excluded.aliases;

insert into public.venues (
  slug,
  name,
  street_address,
  city,
  region,
  postal_code,
  source,
  status,
  location,
  last_verified_at
)
values
  (
    'galloping-ghost',
    'Galloping Ghost Arcade',
    '9415 Ogden Ave',
    'Brookfield',
    'IL',
    '60513',
    'seed',
    'active',
    extensions.st_setsrid(extensions.st_makepoint(-87.8439, 41.8211), 4326)::extensions.geography,
    '2026-04-16T10:30:00.000Z'
  ),
  (
    'logan-arcade',
    'Logan Arcade',
    '2410 W Fullerton Ave',
    'Chicago',
    'IL',
    '60647',
    'seed',
    'active',
    extensions.st_setsrid(extensions.st_makepoint(-87.6886, 41.9247), 4326)::extensions.geography,
    '2026-04-19T22:00:00.000Z'
  ),
  (
    'emporium-logan-square',
    'Emporium Arcade Bar Logan Square',
    '2363 N Milwaukee Ave',
    'Chicago',
    'IL',
    '60647',
    'seed',
    'active',
    extensions.st_setsrid(extensions.st_makepoint(-87.6992, 41.9233), 4326)::extensions.geography,
    '2026-04-18T20:40:00.000Z'
  )
on conflict (slug) do update
set
  name = excluded.name,
  street_address = excluded.street_address,
  city = excluded.city,
  region = excluded.region,
  postal_code = excluded.postal_code,
  source = excluded.source,
  status = excluded.status,
  location = excluded.location,
  last_verified_at = excluded.last_verified_at;

insert into public.venue_games (
  venue_id,
  game_id,
  quantity,
  availability_status,
  notes,
  confidence_score,
  last_seen_at,
  last_confirmed_at
)
select
  v.id,
  g.id,
  seed.quantity,
  seed.availability_status,
  seed.notes,
  seed.confidence_score,
  seed.last_confirmed_at,
  seed.last_confirmed_at
from (
  values
    ('galloping-ghost', 'street-fighter-iii-3rd-strike', 1, 'confirmed_present', 'Candy cab near the main fighter row.', 0.98, '2026-04-16T10:30:00.000Z'::timestamptz),
    ('galloping-ghost', 'marvel-vs-capcom-2', 1, 'confirmed_present', null, 0.95, '2026-04-14T19:00:00.000Z'::timestamptz),
    ('logan-arcade', 'killer-queen', 1, 'confirmed_present', null, 0.97, '2026-04-19T22:00:00.000Z'::timestamptz),
    ('emporium-logan-square', 'dance-dance-revolution-a20', 1, 'confirmed_present', null, 0.96, '2026-04-18T20:40:00.000Z'::timestamptz)
) as seed(venue_slug, game_slug, quantity, availability_status, notes, confidence_score, last_confirmed_at)
join public.venues v on v.slug = seed.venue_slug
join public.games g on g.slug = seed.game_slug
on conflict (venue_id, game_id) do update
set
  quantity = excluded.quantity,
  availability_status = excluded.availability_status,
  notes = excluded.notes,
  confidence_score = excluded.confidence_score,
  last_seen_at = excluded.last_seen_at,
  last_confirmed_at = excluded.last_confirmed_at;
