# Arcade Aggregator

Mobile-first Expo app for finding the nearest arcade that has the game you want.

## Stack

- Expo + React Native + TypeScript
- Expo Router for navigation
- `expo-location` for foreground device location
- `react-native-maps` for the map surface
- Supabase + Postgres + PostGIS for search, auth, and community data

## Project Structure

- `src/app`: Expo Router screens
- `src/components`: reusable UI blocks
- `src/data`: local mock data for the initial scaffold
- `src/lib`: env, formatting, location, and Supabase helpers
- `supabase/migrations`: SQL schema files
- `supabase/seed.sql`: optional starter data that mirrors the demo venues in the app

## Environment

Create a local `.env` file from `.env.example`.

Required for backend:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Required before shipping store builds with Google Maps:

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

## Run The App

```bash
npm install
npx expo start
```

For device builds:

```bash
eas build --platform android
eas build --platform ios
```

## Apply The Initial Schema

Run the SQL in `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor, or use the Supabase CLI if you have it configured.

Optional sample data lives in `supabase/seed.sql`.

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
