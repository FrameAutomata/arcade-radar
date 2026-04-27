import { distanceInMiles, type Coordinates } from '@/lib/geo';
import type {
  Game,
  NearbyVenueResult,
  Venue,
  VenueInventoryItem,
  VenueMatch,
} from '@/types/domain';

export const defaultUserLocation = {
  latitude: 32.7767,
  longitude: -96.797,
};

export const games: Game[] = [
  {
    id: 'street-fighter-iii-3rd-strike',
    slug: 'street-fighter-iii-3rd-strike',
    title: 'Street Fighter III: 3rd Strike',
    manufacturer: 'Capcom',
    releaseYear: 1999,
    aliases: ['3rd Strike', 'SF3'],
    categories: ['Fighting'],
  },
  {
    id: 'marvel-vs-capcom-2',
    slug: 'marvel-vs-capcom-2',
    title: 'Marvel vs. Capcom 2',
    manufacturer: 'Capcom',
    releaseYear: 2000,
    aliases: ['MVC2'],
    categories: ['Fighting'],
  },
  {
    id: 'dance-dance-revolution-a20',
    slug: 'dance-dance-revolution-a20',
    title: 'DanceDanceRevolution A20',
    manufacturer: 'Konami',
    releaseYear: 2019,
    aliases: ['DDR', 'DDR A20'],
    categories: ['Rhythm'],
  },
  {
    id: 'time-crisis-2',
    slug: 'time-crisis-2',
    title: 'Time Crisis 2',
    manufacturer: 'Namco',
    releaseYear: 1997,
    aliases: ['TC2'],
    categories: ['Light gun'],
  },
  {
    id: 'killer-queen',
    slug: 'killer-queen',
    title: 'Killer Queen',
    manufacturer: 'BumbleBear Games',
    releaseYear: 2013,
    aliases: ['KQ'],
    categories: ['Action'],
  },
];

export const venues: Venue[] = [
  {
    id: 'galloping-ghost',
    slug: 'galloping-ghost',
    name: 'Galloping Ghost Arcade',
    address: '9415 Ogden Ave',
    city: 'Brookfield',
    region: 'IL',
    latitude: 41.8211,
    longitude: -87.8439,
    verifiedByCount: 41,
    notes: 'Huge competitive lineup with strong fighting game coverage.',
    inventory: [
      {
        gameId: 'street-fighter-iii-3rd-strike',
        status: 'confirmed_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-16T10:30:00.000Z',
        note: 'Candy cab near the main fighter row.',
      },
      {
        gameId: 'marvel-vs-capcom-2',
        status: 'confirmed_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-14T19:00:00.000Z',
      },
      {
        gameId: 'time-crisis-2',
        status: 'confirmed_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-09T16:20:00.000Z',
      },
    ],
  },
  {
    id: 'logan-arcade',
    slug: 'logan-arcade',
    name: 'Logan Arcade',
    address: '2410 W Fullerton Ave',
    city: 'Chicago',
    region: 'IL',
    latitude: 41.9247,
    longitude: -87.6886,
    verifiedByCount: 19,
    notes: 'Strong Chicago barcade option with frequent lineup changes.',
    inventory: [
      {
        gameId: 'killer-queen',
        status: 'confirmed_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-19T22:00:00.000Z',
      },
      {
        gameId: 'street-fighter-iii-3rd-strike',
        status: 'rumored_present',
        quantity: 1,
        lastVerifiedAt: '2026-03-28T18:15:00.000Z',
        note: 'Community says it rotates in for events.',
      },
    ],
  },
  {
    id: 'emporium-logan-square',
    slug: 'emporium-logan-square',
    name: 'Emporium Arcade Bar Logan Square',
    address: '2363 N Milwaukee Ave',
    city: 'Chicago',
    region: 'IL',
    latitude: 41.9233,
    longitude: -87.6992,
    verifiedByCount: 13,
    notes: 'Reliable for rhythm and light gun games.',
    inventory: [
      {
        gameId: 'dance-dance-revolution-a20',
        status: 'confirmed_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-18T20:40:00.000Z',
      },
      {
        gameId: 'time-crisis-2',
        status: 'temporarily_unavailable',
        quantity: 1,
        lastVerifiedAt: '2026-04-11T21:05:00.000Z',
        note: 'Reported down for maintenance last week.',
      },
    ],
  },
  {
    id: 'headquarters-river-north',
    slug: 'headquarters-river-north',
    name: 'Headquarters Beercade River North',
    address: '213 W Institute Pl',
    city: 'Chicago',
    region: 'IL',
    latitude: 41.8975,
    longitude: -87.6347,
    verifiedByCount: 8,
    notes: 'Convenient downtown fallback for quick sessions.',
    inventory: [
      {
        gameId: 'marvel-vs-capcom-2',
        status: 'rumored_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-03T17:25:00.000Z',
      },
      {
        gameId: 'killer-queen',
        status: 'confirmed_present',
        quantity: 1,
        lastVerifiedAt: '2026-04-17T23:10:00.000Z',
      },
    ],
  },
];

export const featuredGames = games.slice(0, 4);

export function getGameById(gameId: string): Game | undefined {
  return games.find((game) => game.id === gameId);
}

export function getVenueById(venueId: string): Venue | undefined {
  return venues.find((venue) => venue.id === venueId);
}

function getGameSearchScore(game: Game, query: string): number {
  const normalizedQuery = query.toLowerCase();
  const title = game.title.toLowerCase();
  const aliases = game.aliases.map((alias) => alias.toLowerCase());

  if (title === normalizedQuery || aliases.includes(normalizedQuery)) {
    return 100;
  }

  if (title.startsWith(normalizedQuery)) {
    return 80;
  }

  if (title.includes(normalizedQuery)) {
    return 60;
  }

  if (aliases.some((alias) => alias.includes(normalizedQuery))) {
    return 50;
  }

  if (game.manufacturer.toLowerCase().includes(normalizedQuery)) {
    return 20;
  }

  if (game.categories.some((category) => category.toLowerCase().includes(normalizedQuery))) {
    return 15;
  }

  return 0;
}

export function searchGames(query: string, limit = 6): Game[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return featuredGames;
  }

  return [...games]
    .map((game) => ({
      game,
      score: getGameSearchScore(game, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ game }) => game);
}

function getInventoryItem(
  venue: Venue,
  gameId: string
): VenueInventoryItem | undefined {
  return venue.inventory.find((item) => item.gameId === gameId);
}

export function findVenueMatches(
  gameId: string,
  userLocation: Coordinates,
  maxDistanceMiles = Infinity
): VenueMatch[] {
  const game = getGameById(gameId);

  if (!game) {
    return [];
  }

  return venues
    .map((venue) => {
      const inventory = getInventoryItem(venue, gameId);

      if (!inventory) {
        return null;
      }

      return {
        game,
        inventory,
        venue,
        distanceMiles: distanceInMiles(userLocation, {
          latitude: venue.latitude,
          longitude: venue.longitude,
        }),
      };
    })
    .filter((match): match is VenueMatch => match !== null)
    .filter((match) => match.distanceMiles <= maxDistanceMiles)
    .sort((left, right) => {
      if (left.inventory.status !== right.inventory.status) {
        return getStatusSortValue(left.inventory.status) -
          getStatusSortValue(right.inventory.status);
      }

      return left.distanceMiles - right.distanceMiles;
    });
}

export function findNearbyVenues(
  userLocation: Coordinates,
  maxDistanceMiles = Infinity
): NearbyVenueResult[] {
  return [...venues]
    .map((venue) => ({
      venue,
      distanceMiles: distanceInMiles(userLocation, {
        latitude: venue.latitude,
        longitude: venue.longitude,
      }),
    }))
    .filter((result) => result.distanceMiles <= maxDistanceMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}

function getStatusSortValue(status: VenueInventoryItem['status']): number {
  switch (status) {
    case 'confirmed_present':
      return 0;
    case 'temporarily_unavailable':
      return 1;
    case 'rumored_present':
      return 2;
    default:
      return 3;
  }
}
