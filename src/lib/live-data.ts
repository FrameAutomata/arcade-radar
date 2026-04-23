import {
  defaultUserLocation,
  findNearbyVenues,
  findVenueMatches,
  getGameById,
  getVenueById,
  searchGames,
} from '@/data/mock-data';
import { distanceInMiles, type Coordinates } from '@/lib/geo';
import { hasSupabaseCredentials } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type {
  Game,
  InventoryStatus,
  NearbyVenueResult,
  Venue,
  VenueInventoryItem,
  VenueMatch,
} from '@/types/domain';

type SearchGameRow = Database['public']['Functions']['search_games']['Returns'][number];
type GameTableRow = Database['public']['Tables']['games']['Row'];
type NearbyVenueRow =
  Database['public']['Functions']['find_nearest_venues']['Returns'][number];
type VenueMatchRow =
  Database['public']['Functions']['find_nearest_venues_for_game']['Returns'][number];
type VenueDetailRow =
  Database['public']['Functions']['get_venue_details']['Returns'][number];

export interface VenueDetailsModel {
  gamesById: Record<string, Game>;
  venue: Venue;
}

function assertSupabase() {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  return supabase;
}

function mapGame(row: SearchGameRow): Game {
  return {
    id: row.game_id,
    slug: row.slug,
    title: row.title,
    manufacturer: row.manufacturer ?? 'Unknown',
    releaseYear: row.release_year ?? 0,
    aliases: row.aliases ?? [],
  };
}

function mapGameTableRow(row: GameTableRow): Game {
  return {
    aliases: row.aliases ?? [],
    id: row.id,
    manufacturer: row.manufacturer ?? 'Unknown',
    releaseYear: row.release_year ?? 0,
    slug: row.slug,
    title: row.title,
  };
}

function buildPlaceholderInventory(count: number): VenueInventoryItem[] {
  return Array.from({ length: count }, (_, index) => ({
    gameId: `tracked-${index + 1}`,
    lastVerifiedAt: new Date().toISOString(),
    quantity: 1,
    status: 'confirmed_present',
  }));
}

function toInventoryStatus(status: string | null | undefined): InventoryStatus {
  switch (status) {
    case 'confirmed_present':
    case 'rumored_present':
    case 'temporarily_unavailable':
      return status;
    default:
      return 'rumored_present';
  }
}

function mapNearbyVenue(row: NearbyVenueRow, userLocation: Coordinates): NearbyVenueResult {
  return {
    distanceMiles: distanceInMiles(userLocation, {
      latitude: row.latitude,
      longitude: row.longitude,
    }),
    venue: {
      address: row.street_address ?? 'Address unavailable',
      city: row.city,
      id: row.venue_id,
      inventory: buildPlaceholderInventory(row.tracked_game_count),
      latitude: row.latitude,
      longitude: row.longitude,
      name: row.venue_name,
      region: row.region,
      slug: row.venue_slug,
      verifiedByCount: 0,
    },
  };
}

function mapVenueMatch(row: VenueMatchRow, game: Game, userLocation: Coordinates): VenueMatch {
  const inventory: VenueInventoryItem = {
    gameId: game.id,
    lastVerifiedAt:
      row.last_confirmed_at ?? new Date().toISOString(),
    quantity: row.quantity,
    status: toInventoryStatus(row.availability_status),
  };

  return {
    distanceMiles: distanceInMiles(userLocation, {
      latitude: row.latitude,
      longitude: row.longitude,
    }),
    game,
    inventory,
    venue: {
      address: row.street_address ?? 'Address unavailable',
      city: row.city,
      id: row.venue_id,
      inventory: [inventory],
      latitude: row.latitude,
      longitude: row.longitude,
      name: row.venue_name,
      region: row.region,
      slug: row.venue_slug,
      verifiedByCount: 0,
    },
  };
}

function buildVenueDetailsModel(rows: VenueDetailRow[]): VenueDetailsModel | null {
  const firstRow = rows[0];

  if (!firstRow) {
    return null;
  }

  const notesValue = firstRow.metadata?.notes;
  const notes =
    typeof notesValue === 'string' && notesValue.trim().length > 0
      ? notesValue
      : 'Community-maintained venue profile. Inventory and verification history will improve as more reports come in.';

  const gamesById = rows.reduce<Record<string, Game>>((accumulator, row) => {
    if (!row.game_id || !row.game_title) {
      return accumulator;
    }

    accumulator[row.game_id] = {
      aliases: row.aliases ?? [],
      id: row.game_id,
      manufacturer: row.manufacturer ?? 'Unknown',
      releaseYear: row.release_year ?? 0,
      slug: row.game_slug ?? row.game_id,
      title: row.game_title,
    };

    return accumulator;
  }, {});

  const inventory = rows
    .filter((row) => row.game_id && row.quantity && row.availability_status)
    .map(
      (row): VenueInventoryItem => ({
        gameId: row.game_id!,
        lastVerifiedAt: row.last_confirmed_at ?? row.last_seen_at ?? new Date().toISOString(),
        note: row.notes ?? undefined,
        quantity: row.quantity!,
        status: toInventoryStatus(row.availability_status),
      })
    );

  return {
    gamesById,
    venue: {
      address: firstRow.street_address ?? 'Address unavailable',
      city: firstRow.city,
      id: firstRow.venue_id,
      inventory,
      latitude: firstRow.latitude,
      longitude: firstRow.longitude,
      name: firstRow.venue_name,
      notes,
      region: firstRow.region,
      slug: firstRow.venue_slug,
      verifiedByCount: firstRow.verified_report_count,
    },
  };
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

  const rows = (data ?? []) as SearchGameRow[];

  return rows.map(mapGame);
}

export async function getFeaturedGamesLive(limit = 4): Promise<Game[]> {
  const client = assertSupabase();

  if (!client) {
    return searchGames('', limit);
  }

  const { data, error } = await client
    .from('games')
    .select('id, slug, title, manufacturer, release_year, aliases')
    .order('title', { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as GameTableRow[];

  return rows.map(mapGameTableRow);
}

export async function findNearbyVenuesLive(
  userLocation: Coordinates
): Promise<NearbyVenueResult[]> {
  const client = assertSupabase();

  if (!client) {
    return findNearbyVenues(userLocation);
  }

  const { data, error } = await client.rpc(
    'find_nearest_venues' as never,
    {
      user_lat: userLocation.latitude,
      user_lng: userLocation.longitude,
    } as never,
  );

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as NearbyVenueRow[];

  return rows.map((row) => mapNearbyVenue(row, userLocation));
}

export async function findVenueMatchesLive(
  game: Game,
  userLocation: Coordinates
): Promise<NearbyVenueResult[]> {
  const client = assertSupabase();

  if (!client) {
    return findVenueMatches(game.id, userLocation);
  }

  const { data, error } = await client.rpc(
    'find_nearest_venues_for_game' as never,
    {
      selected_game_id: game.id,
      user_lat: userLocation.latitude,
      user_lng: userLocation.longitude,
    } as never,
  );

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as VenueMatchRow[];

  return rows.map((row) => mapVenueMatch(row, game, userLocation));
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

    return {
      gamesById,
      venue,
    };
  }

  const { data, error } = await client.rpc(
    'get_venue_details' as never,
    {
      selected_venue_id: venueId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as VenueDetailRow[];

  return buildVenueDetailsModel(rows);
}

export { defaultUserLocation };
