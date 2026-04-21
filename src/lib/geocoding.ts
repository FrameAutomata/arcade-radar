import * as Location from 'expo-location';

import { supabase } from '@/lib/supabase';
import type { Coordinates } from '@/lib/geo';

interface ResolvedLocation {
  coordinates: Coordinates;
  label: string;
}

const presetLocations: Array<{
  coordinates: Coordinates;
  label: string;
  terms: string[];
}> = [
  {
    coordinates: {
      latitude: 41.9295,
      longitude: -87.7071,
    },
    label: 'Logan Square, Chicago, IL',
    terms: ['60647', 'logan square', 'chicago', 'illinois'],
  },
  {
    coordinates: {
      latitude: 41.8211,
      longitude: -87.8439,
    },
    label: 'Brookfield, IL 60513',
    terms: ['60513', 'brookfield', 'ogden ave'],
  },
  {
    coordinates: {
      latitude: 41.8975,
      longitude: -87.6347,
    },
    label: 'River North, Chicago, IL',
    terms: ['60654', 'river north', 'downtown chicago'],
  },
];

export async function resolveAppLocation(
  query: string
): Promise<ResolvedLocation | null> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return null;
  }

  const serverResolvedLocation = await resolveWithSupabase(trimmedQuery);

  if (serverResolvedLocation) {
    return serverResolvedLocation;
  }

  return resolveWithLocalFallback(trimmedQuery);
}

async function resolveWithSupabase(
  query: string
): Promise<ResolvedLocation | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke('geocode', {
      body: { query },
    });

    if (error || !data) {
      return null;
    }

    if (
      typeof data.latitude !== 'number' ||
      typeof data.longitude !== 'number' ||
      typeof data.label !== 'string'
    ) {
      return null;
    }

    return {
      coordinates: {
        latitude: data.latitude,
        longitude: data.longitude,
      },
      label: data.label,
    };
  } catch {
    return null;
  }
}

async function resolveWithLocalFallback(
  query: string
): Promise<ResolvedLocation | null> {
  const normalizedQuery = query.toLowerCase();
  const presetMatch = presetLocations.find((location) =>
    location.terms.some((term) => normalizedQuery.includes(term))
  );

  if (presetMatch) {
    return {
      coordinates: presetMatch.coordinates,
      label: presetMatch.label,
    };
  }

  try {
    const geocodeResults = await Location.geocodeAsync(query);

    if (geocodeResults.length === 0) {
      return null;
    }

    const bestResult = geocodeResults[0];

    return {
      coordinates: {
        latitude: bestResult.latitude,
        longitude: bestResult.longitude,
      },
      label: `${query} • ${bestResult.latitude.toFixed(4)}, ${bestResult.longitude.toFixed(4)}`,
    };
  } catch {
    return null;
  }
}
