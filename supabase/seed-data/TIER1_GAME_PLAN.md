# Tier 1 Starter Catalog Plan

This file defines the first practical game batch to seed for Arcade Radar.

Use [games_tier1_starter.csv](C:\dev\arcade-radar\supabase\seed-data\games_tier1_starter.csv)
as the first-pass import candidate list.

## Why This Batch Exists

Tier 1 should cover the titles people are most likely to:

- search for by name
- travel for
- recognize immediately
- expect to find in enthusiast arcades, barcades, and larger family arcades

This batch is intentionally biased toward:

- fighting games
- rhythm games
- light gun games
- racing games
- co-op beat 'em ups
- evergreen classics
- a few modern destination titles

## Recommended Use

1. Review `games_tier1_starter.csv`
2. Merge any approved rows into `games_catalog_template.csv`
3. Add or remove titles based on your actual DFW scouting priorities
4. Run `npm run seed:build`
5. Review `supabase/seed.generated.sql`

## Suggested First Search QA

After seeding the Tier 1 set, verify:

- `mvc2`
- `third strike`
- `tekken 3`
- `umk3`
- `ddr`
- `ddr a20`
- `pump it up`
- `sound voltex`
- `time crisis`
- `house of the dead`
- `daytona`
- `initial d`
- `killer queen`
- `tmnt`
- `simpsons`
- `ms pac man`

## Notes

- This is a practical starter set, not a final national catalog.
- You should expect to grow this into a larger Tier 2 catalog after the first
  real DFW scouting passes.
- If a title feels too niche for your first wave, keep it in this file for
  review instead of immediately moving it into the main template.
