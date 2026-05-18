import { distanceInMiles, type Coordinates } from '@/lib/geo';
import type { Database } from '@/types/database';
import type {
  Game,
  InventoryStatus,
  NearbyVenueResult,
  VenueDayHours,
  VenueHours,
  VenueInventoryItem,
  VenueMatch,
} from '@/types/domain';

export const METERS_PER_MILE = 1609.344;

export type SearchGameRow = Database['public']['Functions']['search_games']['Returns'][number];
export type GameTableRow = Database['public']['Tables']['games']['Row'];
export type NearbyVenueRow =
  Database['public']['Functions']['find_nearest_venues']['Returns'][number];
export type VenueMatchRow =
  Database['public']['Functions']['find_nearest_venues_for_game']['Returns'][number];
export type VenueDetailRow =
  Database['public']['Functions']['get_venue_details']['Returns'][number];

export interface VenueDetailsModel {
  gamesById: Record<string, Game>;
  venue: import('@/types/domain').Venue;
}

export function mapGame(row: SearchGameRow): Game {
  return {
    aliases: row.aliases ?? [],
    categories: row.categories ?? [],
    id: row.game_id,
    manufacturer: row.manufacturer ?? 'Unknown',
    releaseYear: row.release_year ?? 0,
    slug: row.slug,
    title: row.title,
  };
}

export function mapGameTableRow(row: GameTableRow): Game {
  return {
    aliases: row.aliases ?? [],
    categories: row.categories ?? [],
    id: row.id,
    manufacturer: row.manufacturer ?? 'Unknown',
    releaseYear: row.release_year ?? 0,
    slug: row.slug,
    title: row.title,
  };
}

export function buildPlaceholderInventory(count: number): VenueInventoryItem[] {
  return Array.from({ length: count }, (_, index) => ({
    gameId: `tracked-${index + 1}`,
    lastVerifiedAt: new Date().toISOString(),
    quantity: 1,
    status: 'confirmed_present' as InventoryStatus,
  }));
}

export function toInventoryStatus(status: string | null | undefined): InventoryStatus {
  switch (status) {
    case 'confirmed_present':
    case 'rumored_present':
    case 'temporarily_unavailable':
    case 'removed':
      return status;
    default:
      return 'rumored_present';
  }
}

export function mapNearbyVenue(row: NearbyVenueRow, userLocation: Coordinates): NearbyVenueResult {
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
      notes: row.notes ?? undefined,
      region: row.region,
      slug: row.venue_slug,
      verifiedByCount: row.verified_report_count,
    },
  };
}

export function mapVenueMatch(row: VenueMatchRow, game: Game, userLocation: Coordinates): VenueMatch {
  const inventory: VenueInventoryItem = {
    gameId: game.id,
    lastVerifiedAt: row.last_confirmed_at ?? new Date().toISOString(),
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
    },
  };
}

function parseHours(raw: Record<string, unknown> | null | undefined): VenueHours | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const result: VenueHours = {};
  for (const day of days) {
    const entry = (raw as Record<string, unknown>)[day];
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const { open, close } = entry as Record<string, unknown>;
      if (typeof open === 'string' && typeof close === 'string') {
        result[day] = { open, close } satisfies VenueDayHours;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function buildVenueDetailsModel(rows: VenueDetailRow[]): VenueDetailsModel | null {
  const firstRow = rows[0];

  if (!firstRow) {
    return null;
  }

  const notes =
    firstRow.venue_description?.trim() ||
    'Community-maintained venue profile. Inventory and verification history will improve as more reports come in.';

  const gamesById = rows.reduce<Record<string, Game>>((accumulator, row) => {
    if (!row.game_id || !row.game_title) {
      return accumulator;
    }

    accumulator[row.game_id] = {
      aliases: row.aliases ?? [],
      categories: row.categories ?? [],
      id: row.game_id,
      manufacturer: row.manufacturer ?? 'Unknown',
      releaseYear: row.release_year ?? 0,
      slug: row.game_slug ?? row.game_id,
      title: row.game_title,
    };

    return accumulator;
  }, {});

  const inventory = rows
    .filter((row) => row.game_id && row.quantity !== null && row.availability_status)
    .map(
      (row): VenueInventoryItem => ({
        confidenceScore: row.confidence_score ?? undefined,
        gameId: row.game_id!,
        lastVerifiedAt: row.last_confirmed_at ?? row.last_seen_at ?? new Date().toISOString(),
        machineLabel: row.machine_label ?? undefined,
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
      country: firstRow.country,
      entryFee: firstRow.entry_fee ?? undefined,
      facebook: firstRow.facebook ?? undefined,
      hours: parseHours(firstRow.hours),
      id: firstRow.venue_id,
      inventory,
      lastVerifiedAt: firstRow.last_verified_at ?? undefined,
      latitude: firstRow.latitude,
      longitude: firstRow.longitude,
      name: firstRow.venue_name,
      notes,
      phone: firstRow.phone ?? undefined,
      postalCode: firstRow.postal_code ?? undefined,
      region: firstRow.region,
      slug: firstRow.venue_slug,
      status: firstRow.venue_status,
      twitter: firstRow.twitter ?? undefined,
      verifiedByCount: firstRow.verified_report_count,
      website: firstRow.website ?? undefined,
    },
  };
}
