# Arcade Radar Seed Strategy

This document defines the practical seed workflow for `games`, `venues`, and
future inventory imports.

The goal is not to capture every arcade title ever released before scouting
starts. The goal is to make on-site scouting fast and reliable by preloading:

- a strong canonical game catalog
- the known venues in the metro you are targeting
- enough aliases that field search works the way people naturally type

## Core Principles

1. Optimize for field use, not archival completeness.
2. Keep one canonical row per searchable game.
3. Use aliases aggressively for searchability.
4. Pre-seed venues for the area you plan to scout first.
5. Let Scout Mode create inventory reports, not raw catalog entries by default.

## Recommended Scope

Start with:

- 30 to 60 DFW venues
- 300 to 500 games
- strong alias coverage

Expand later into:

- additional Texas metros
- more niche variants
- long-tail/import titles

## Canonical Game Rules

Each row in `public.games` should represent one canonical title users can
search for and scouts can intentionally identify on location.

Use a separate row when players or scouts materially care about the difference.

Examples that should usually be separate:

- `Street Fighter III: 3rd Strike`
- `Street Fighter III: New Generation`
- `DanceDanceRevolution A20`
- `DanceDanceRevolution A20 Plus`
- `Time Crisis 2`
- `Time Crisis 3`

Use aliases instead of separate rows when the terms are just alternate ways to
refer to the same canonical title.

Examples:

- `MVC2` -> `Marvel vs. Capcom 2`
- `Third Strike` -> `Street Fighter III: 3rd Strike`
- `DDR A20+` -> `DanceDanceRevolution A20 Plus`

## Current Schema Fields

Current `public.games` columns:

- `slug`
- `title`
- `manufacturer`
- `release_year`
- `aliases`

This is enough for the first curated import.

Later optional additions if the catalog grows:

- `series`
- `genre`
- `platform_hardware`
- `parent_game_id`
- `is_variant`
- `search_priority`
- `source`
- `metadata`

## Venue Seed Rules

Each row in `public.venues` should be a real, scoutable place.

Required practical fields:

- `slug`
- `name`
- `street_address`
- `city`
- `region`
- `postal_code`
- `source`
- `status`
- coordinates for `location`

Recommended metadata later:

- neighborhood
- venue notes
- website
- social links
- family-friendly / 21+ / barcade tag

## Seed File Structure

Use these files:

- `supabase/seed-data/games_catalog_template.csv`
- `supabase/seed-data/venues_dfw_template.csv`
- `supabase/seed-data/build-seed-sql.mjs`
- `supabase/seed.generated.sql`
- `supabase/seed.sql`

Recommended workflow:

1. collect raw titles and venue info into the CSV templates
2. normalize titles, aliases, and slugs
3. review duplicates and variants
4. convert approved rows into `seed.sql`
5. run `seed.sql`
6. test app search against real-world queries

For bulk generation from the CSV templates:

1. update the CSV files
2. run `npm run seed:build`
3. if Supabase URL/key are available in the project `.env`, missing venue coordinates will be auto-filled
   into `supabase/seed-data/venues_dfw_template.geocoded.csv`
4. review `supabase/seed.generated.sql`
5. copy approved sections into `supabase/seed.sql` or run the generated file directly

Local config sources:

- `.env`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`

The seed builder calls your deployed Supabase `geocode` Edge Function instead of
calling Mapbox directly. That means the Mapbox token can remain stored only as a
Supabase secret.

The generator keeps a simple cache in:

- `supabase/seed-data/.geocode-cache.json`

This avoids repeatedly geocoding the same venue rows.

## Game Catalog Curation Rules

### Slugs

Make slugs:

- lowercase
- stable
- human-readable
- based on canonical title, not aliases

Examples:

- `marvel-vs-capcom-2`
- `street-fighter-iii-3rd-strike`
- `dance-dance-revolution-a20-plus`

### Manufacturer Normalization

Use one consistent value per manufacturer.

Examples:

- `Capcom`
- `Konami`
- `Namco`
- `Sega`
- `Raw Thrills`
- `Bally Midway`

Avoid mixing variants like:

- `NAMCO`
- `Namco Bandai`
- `Bandai Namco`

unless you intentionally want those distinctions.

### Alias Rules

Aliases should include:

- common abbreviations
- punctuation variants
- subtitle-only references
- common misspellings
- shorthand players actually use

Examples:

`Marvel vs. Capcom 2`

- `mvc2`
- `marvel 2`
- `marvel vs capcom 2`

`Street Fighter III: 3rd Strike`

- `3rd strike`
- `third strike`
- `sfiii 3s`
- `sf3s`

`DanceDanceRevolution A20 Plus`

- `ddr a20 plus`
- `ddr a20+`
- `a20 plus`

Store aliases as a pipe-delimited review value in CSV, then convert them into
Postgres arrays in `seed.sql`.

## Practical Game Tiers

### Tier 1: Must-have starter catalog

Seed these first:

- fighting game staples
- rhythm staples
- light gun staples
- racer staples
- beat 'em up staples
- major modern Raw Thrills / family arcade staples
- widely searched classics

### Tier 2: Strong national coverage

Add:

- additional sequels
- notable variants
- common regional staples
- popular redemption/search titles

### Tier 3: Long tail

Add later:

- obscure imports
- rare revisions
- collector-focused titles
- deep niche genre entries

## Recommended First Import Targets

Games:

- 300 to 500 curated rows

Venues:

- 30 to 60 DFW venues

Inventory:

- do not bulk-guess it
- collect through Scout Mode and approvals

## Suggested DFW Venue Categories

When pre-seeding venues, include:

- dedicated arcades
- barcades
- family entertainment centers
- movie theater arcades worth searching
- major bowling/entertainment venues if they have notable game floors

## Import Workflow

### Games

1. Fill `games_catalog_template.csv`
2. Normalize manufacturers and aliases
3. Split true variants into separate rows
4. Convert rows into `insert into public.games ...`
5. Run `search_games(...)` against common field queries
6. Regenerate `supabase/seed.generated.sql` after each batch with `npm run seed:build`

### Venues

1. Fill `venues_dfw_template.csv`
2. Make sure `.env` contains `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`
3. Run `npm run seed:build`
4. The builder will call the Supabase `geocode` Edge Function for rows missing coordinates
5. Review `venues_dfw_template.geocoded.csv`
6. Convert into `insert into public.venues ...`
7. Verify they appear in `find_nearest_venues(...)`
8. Regenerate `supabase/seed.generated.sql` after each batch with `npm run seed:build`

## Search QA Checklist

Before treating a catalog batch as ready, test queries like:

- `mvc2`
- `marvel 2`
- `third strike`
- `3rd strike`
- `ddr`
- `ddr a20`
- `time crisis`
- `initial d`
- `house of the dead`

If common player queries do not resolve, improve aliases before adding more rows.

## Decision Defaults

If uncertain, use these defaults:

- prefer fewer, cleaner canonical rows
- add aliases rather than duplicate titles
- split variants only when users genuinely care
- pre-seed venues before field scouting
- use Scout Mode to collect inventory, not to build the entire catalog in real time
