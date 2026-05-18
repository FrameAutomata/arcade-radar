import {
  defaultUserLocation,
  findNearbyVenues,
  findVenueMatches,
  getGameById,
  getVenueById,
  searchGames,
} from '@/data/mock-data';
import { hasSupabaseCredentials } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/lib/geo';
import type { Game, NearbyVenueResult } from '@/types/domain';

import {
  buildVenueDetailsModel,
  mapGame,
  mapGameTableRow,
  mapNearbyVenue,
  mapVenueMatch,
  METERS_PER_MILE,
  type GameTableRow,
  type NearbyVenueRow,
  type SearchGameRow,
  type VenueDetailRow,
  type VenueDetailsModel,
  type VenueMatchRow,
} from './live-data.mappers';

export * from './live-data.mappers';
export { defaultUserLocation };

function assertSupabase() {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  return supabase;
}

export async function searchGamesLive(query: string, limit = 6): Promise<Game[]> {
  const trimmedQuery = query.trim();
  const client = assertSupabase();

  if (!trimmedQuery) {
    return searchGames('', limit);
  }

  if (!client) {
    return searchGames(trimmedQuery, limit);
  }

  const { data, error } = await client.rpc(
    'search_games' as never,
    {
      result_limit: limit,
      search_query: trimmedQuery,
    } as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as SearchGameRow[]).map(mapGame);
}

export async function getFeaturedGamesLive(limit = 4): Promise<Game[]> {
  const client = assertSupabase();

  if (!client) {
    return searchGames('', limit);
  }

  const { data, error } = await client
    .from('games')
    .select('id, slug, title, manufacturer, release_year, aliases, categories')
    .order('title', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as GameTableRow[]).map(mapGameTableRow);
}

export async function findNearbyVenuesLive(
  userLocation: Coordinates,
  maxDistanceMiles = 50,
): Promise<NearbyVenueResult[]> {
  const client = assertSupabase();

  if (!client) {
    return findNearbyVenues(userLocation, maxDistanceMiles);
  }

  const { data, error } = await client.rpc(
    'find_nearest_venues' as never,
    {
      max_distance_meters: Math.round(maxDistanceMiles * METERS_PER_MILE),
      user_lat: userLocation.latitude,
      user_lng: userLocation.longitude,
    } as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as NearbyVenueRow[]).map((row) => mapNearbyVenue(row, userLocation));
}

export async function findVenueMatchesLive(
  game: Game,
  userLocation: Coordinates,
  maxDistanceMiles = 50,
): Promise<NearbyVenueResult[]> {
  const client = assertSupabase();

  if (!client) {
    return findVenueMatches(game.id, userLocation, maxDistanceMiles);
  }

  const { data, error } = await client.rpc(
    'find_nearest_venues_for_game' as never,
    {
      max_distance_meters: Math.round(maxDistanceMiles * METERS_PER_MILE),
      selected_game_id: game.id,
      user_lat: userLocation.latitude,
      user_lng: userLocation.longitude,
    } as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as VenueMatchRow[]).map((row) => mapVenueMatch(row, game, userLocation));
}

export async function getVenueDetailsLive(
  venueId: string,
): Promise<VenueDetailsModel | null> {
  const client = assertSupabase();

  if (!client) {
    const venue = getVenueById(venueId);

    if (!venue) {
      return null;
    }

    const gamesById = venue.inventory.reduce<Record<string, Game>>(
      (accumulator, item) => {
        const game = getGameById(item.gameId);

        if (game) {
          accumulator[item.gameId] = game;
        }

        return accumulator;
      },
      {},
    );

    return { gamesById, venue };
  }

  const { data, error } = await client.rpc(
    'get_venue_details' as never,
    { selected_venue_id: venueId } as never,
  );

  if (error) {
    throw error;
  }

  return buildVenueDetailsModel((data ?? []) as VenueDetailRow[]);
}
