# DFW Venue Catalog Plan

This file is the first practical venue shortlist for Arcade Radar in the
Dallas-Fort Worth area.

Primary catalog file:

- [venues_dfw_popular_catalog.csv](C:\dev\arcade-radar\supabase\seed-data\venues_dfw_popular_catalog.csv)

## Why This List Exists

This is not meant to be every single place in DFW with an arcade room.

It is meant to give you a high-value first wave of venues that are:

- well-known
- likely to be searched by users
- large enough to matter
- good candidates for founder-led scouting

## Suggested First-Wave Priorities

### Tier 1

These are the best early scouting targets because they are high-traffic,
high-visibility, and likely to have enough inventory to make the app feel real
quickly:

- Cidercade Dallas
- Cidercade Arlington
- Cidercade Fort Worth
- Free Play Richardson
- Free Play Dallas
- Free Play Arlington
- Free Play Fort Worth
- Free Play Denton
- Round1 Grapevine Mills
- Round1 Arlington Parks

### Tier 2

Good follow-up venues once the first wave is seeded and scouted:

- Nickel Mania Carrollton
- Arcade 92 McKinney
- Arcade 92 Flower Mound
- Electric Starship Arcade

## Practical Recommendation

For the first real DFW rollout:

1. pre-seed this catalog into your venue template
2. geocode the coordinates
3. seed the venues
4. personally scout Tier 1 first
5. use Scout Mode for inventory reports
6. approve reports into live venue inventory

## Why Founder Scouting Still Matters

This catalog gives you a strong venue base, but it should not be treated as
inventory truth.

Use the catalog for:

- venue discovery
- address normalization
- pre-seeding
- planning your scouting runs

Use personal scouting for:

- actual machine presence
- quantity
- cabinet notes
- machine status
- confidence in the final data

## Next Step

The next practical task is to move the approved venues from this catalog into:

- `venues_dfw_template.csv`

with latitude and longitude filled in, so `npm run seed:build` can generate the
actual venue upserts.
