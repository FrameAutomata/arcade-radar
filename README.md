# Arcade Radar

Mobile-first Expo app for finding the nearest arcade that has the game you want.

## Stack

- Expo + React Native + TypeScript
- Expo Router for navigation
- `expo-location` for foreground device location
- Leaflet on web and MapLibre on native for a non-Google map stack
- Supabase + Postgres + PostGIS for search, auth, and community data

## Project Structure

- `src/app`: Expo Router screens
- `src/components`: reusable UI blocks
- `src/data`: local mock data for the initial scaffold
- `src/lib`: env, formatting, location, and Supabase helpers
- `supabase/migrations`: SQL schema files
- `supabase/seed.sql`: optional starter data that mirrors the demo venues in the app

## Environment

Create a local `.env.local` file, or use your existing one.

Required for backend:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY`

For server-side geocoding with the Supabase Edge Function:

- Set the Supabase secret `MAPBOX_ACCESS_TOKEN`

## Run The App

```bash
npm install
npx expo start
```

Native MapLibre note:

- Web works in the normal Expo web flow
- iOS and Android require a development build, not Expo Go, because `@maplibre/maplibre-react-native` is custom native code

For device builds:

```bash
eas build --platform android
eas build --platform ios
```

## Apply The Initial Schema

Run the SQL in `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor, or use the Supabase CLI if you have it configured.

Optional sample data lives in `supabase/seed.sql`.

## Geocoding Setup

Manual address and ZIP search is implemented through a Supabase Edge Function so the
provider token stays off the client.

1. Create a Mapbox access token with Search / Geocoding access.
2. Set the Supabase secret:

```bash
npx supabase secrets set MAPBOX_ACCESS_TOKEN=your_token_here
```

3. Deploy the Edge Function:

```bash
npx supabase functions deploy geocode
```

Once your app has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`, the
manual location form will call that function. If the backend is not configured yet, the app
falls back to a limited demo resolver for a few local test areas.

## Map Stack Note

This project no longer assumes Google Maps Platform.

- Web uses Leaflet with OpenStreetMap-based tiles
- Address and ZIP lookup uses the server-side Mapbox geocoding function
- Users are expected to open Apple Maps or Google Maps externally for navigation

## What The Scaffold Includes

- Search-first home screen with game suggestions
- Device location request flow
- Map + nearest venue list using demo data
- Venue detail screen
- Supabase client wiring with AsyncStorage-backed auth persistence
- Initial PostGIS schema for games, venues, inventory, and community reports

## Recommended Next Steps

1. Add Supabase Auth for email magic links or OAuth.
2. Replace the mock search with the SQL functions in the migration.
3. Add a submission flow so players can confirm machine availability.
4. Add moderation tools for approving or rejecting reports.
