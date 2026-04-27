import {
  defaultUserLocation,
  findNearbyVenues,
  findVenueMatches,
  getGameById,
  searchGames,
} from '@/data/mock-data';
import { buildMapRegion, type Coordinates } from '@/lib/geo';
import type { Game, NearbyVenueResult } from '@/types/domain';

export const demoLocationLabel = 'DFW demo location';

export function sanitizeCoordinates(
  latitude?: string | string[],
  longitude?: string | string[]
): Coordinates {
  const parsedLatitude = parseParamNumber(latitude);
  const parsedLongitude = parseParamNumber(longitude);

  if (parsedLatitude === null || parsedLongitude === null) {
    return defaultUserLocation;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

export function parseParamString(value?: string | string[]): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return null;
}

export function buildResultsModel(
  gameId: string | null,
  userLocation: Coordinates
) {
  const game = gameId ? getGameById(gameId) ?? null : null;
  const results: NearbyVenueResult[] = game
    ? findVenueMatches(game.id, userLocation)
    : findNearbyVenues(userLocation);
  const mapRegion = buildMapRegion(
    userLocation,
    results.map((result) => ({
      latitude: result.venue.latitude,
      longitude: result.venue.longitude,
    }))
  );

  return {
    game,
    mapRegion,
    results,
  };
}

export function resolveSelectedGame(
  selectedGameId: string | null,
  query: string
): Game | null {
  if (selectedGameId) {
    return getGameById(selectedGameId) ?? null;
  }

  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return null;
  }

  return searchGames(normalizedQuery, 1)[0] ?? null;
}

function parseParamNumber(value?: string | string[]): number | null {
  const rawValue = parseParamString(value);

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}
