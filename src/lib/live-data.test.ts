import { describe, expect, it } from 'vitest';

import type { Game } from '@/types/domain';

import {
  buildPlaceholderInventory,
  buildVenueDetailsModel,
  mapGame,
  mapGameTableRow,
  mapNearbyVenue,
  mapVenueMatch,
  toInventoryStatus,
} from './live-data';

const dallas = { latitude: 32.7767, longitude: -96.797 };

describe('live-data game mappers', () => {
  it('maps search RPC rows into app games with safe defaults', () => {
    expect(
      mapGame({
        aliases: [],
        categories: [],
        game_id: 'mvc2',
        manufacturer: null,
        release_year: null,
        similarity_score: 0.9,
        slug: 'marvel-vs-capcom-2',
        title: 'Marvel vs. Capcom 2',
      }),
    ).toEqual({
      aliases: [],
      categories: [],
      id: 'mvc2',
      manufacturer: 'Unknown',
      releaseYear: 0,
      slug: 'marvel-vs-capcom-2',
      title: 'Marvel vs. Capcom 2',
    });
  });

  it('maps game table rows into app games', () => {
    expect(
      mapGameTableRow({
        aliases: ['3rd Strike'],
        categories: ['Fighting'],
        created_at: '2026-04-01T00:00:00Z',
        external_ids: {},
        id: 'sf3',
        manufacturer: 'Capcom',
        metadata: {},
        release_year: 1999,
        slug: 'street-fighter-iii-3rd-strike',
        title: 'Street Fighter III: 3rd Strike',
        updated_at: '2026-04-01T00:00:00Z',
      }),
    ).toMatchObject({
      categories: ['Fighting'],
      manufacturer: 'Capcom',
      releaseYear: 1999,
      title: 'Street Fighter III: 3rd Strike',
    });
  });
});

describe('live-data venue mappers', () => {
  it('builds placeholder inventory from tracked game counts', () => {
    expect(buildPlaceholderInventory(2)).toEqual([
      expect.objectContaining({ gameId: 'tracked-1', quantity: 1 }),
      expect.objectContaining({ gameId: 'tracked-2', quantity: 1 }),
    ]);
  });

  it('preserves known inventory statuses and defaults unknown values', () => {
    expect(toInventoryStatus('confirmed_present')).toBe('confirmed_present');
    expect(toInventoryStatus('temporarily_unavailable')).toBe(
      'temporarily_unavailable',
    );
    expect(toInventoryStatus('removed')).toBe('removed');
    expect(toInventoryStatus('not-real')).toBe('rumored_present');
    expect(toInventoryStatus(null)).toBe('rumored_present');
  });

  it('maps nearest venue rows into nearby venue results', () => {
    const result = mapNearbyVenue(
      {
        city: 'Dallas',
        distance_meters: 0,
        last_verified_at: null,
        latitude: 32.805817,
        longitude: -96.846625,
        notes: 'Nearly 200 games.',
        postal_code: '75207',
        region: 'TX',
        street_address: '2777 Irving Blvd',
        tracked_game_count: 12,
        venue_id: 'cidercade-dallas',
        venue_name: 'Cidercade Dallas',
        venue_slug: 'cidercade-dallas',
        verified_report_count: 4,
      },
      dallas,
    );

    expect(result.venue).toMatchObject({
      address: '2777 Irving Blvd',
      city: 'Dallas',
      inventory: expect.arrayContaining([
        expect.objectContaining({ gameId: 'tracked-1' }),
      ]),
      name: 'Cidercade Dallas',
      verifiedByCount: 4,
    });
    expect(result.distanceMiles).toBeGreaterThan(0);
  });

  it('maps game-specific venue matches into venue results', () => {
    const game: Game = {
      aliases: ['MVC2'],
      categories: ['Fighting'],
      id: 'mvc2',
      manufacturer: 'Capcom',
      releaseYear: 2000,
      slug: 'marvel-vs-capcom-2',
      title: 'Marvel vs. Capcom 2',
    };

    const result = mapVenueMatch(
      {
        availability_status: 'temporarily_unavailable',
        city: 'Dallas',
        confidence_score: 0.9,
        distance_meters: 0,
        last_confirmed_at: '2026-04-20T00:00:00Z',
        latitude: 32.805817,
        longitude: -96.846625,
        quantity: 1,
        region: 'TX',
        street_address: '2777 Irving Blvd',
        venue_id: 'cidercade-dallas',
        venue_name: 'Cidercade Dallas',
        venue_slug: 'cidercade-dallas',
      },
      game,
      dallas,
    );

    expect(result.game.title).toBe('Marvel vs. Capcom 2');
    expect(result.inventory).toEqual({
      gameId: 'mvc2',
      lastVerifiedAt: '2026-04-20T00:00:00Z',
      quantity: 1,
      status: 'temporarily_unavailable',
    });
    expect(result.venue.inventory).toHaveLength(1);
  });
});

describe('buildVenueDetailsModel', () => {
  it('returns null for empty RPC responses', () => {
    expect(buildVenueDetailsModel([])).toBeNull();
  });

  it('builds venue details, games, and inventory from detail rows', () => {
    const details = buildVenueDetailsModel([
      {
        aliases: ['MVC2'],
        availability_status: 'removed',
        categories: ['Fighting'],
        city: 'Dallas',
        confidence_score: 0.8,
        country: 'US',
        game_id: 'mvc2',
        game_slug: 'marvel-vs-capcom-2',
        game_title: 'Marvel vs. Capcom 2',
        last_confirmed_at: null,
        last_seen_at: '2026-04-21T00:00:00Z',
        last_verified_at: null,
        latitude: 32.805817,
        longitude: -96.846625,
        machine_label: null,
        manufacturer: 'Capcom',
        metadata: { notes: 'Official site says nearly 200 games.' },
        notes: 'Cabinet was removed.',
        postal_code: '75207',
        quantity: 1,
        region: 'TX',
        release_year: 2000,
        source: 'seed',
        street_address: '2777 Irving Blvd',
        venue_id: 'cidercade-dallas',
        venue_name: 'Cidercade Dallas',
        venue_slug: 'cidercade-dallas',
        venue_status: 'active',
        verified_report_count: 5,
      },
    ]);

    expect(details?.venue).toMatchObject({
      address: '2777 Irving Blvd',
      inventory: [
        {
          gameId: 'mvc2',
          lastVerifiedAt: '2026-04-21T00:00:00Z',
          note: 'Cabinet was removed.',
          quantity: 1,
          status: 'removed',
        },
      ],
      name: 'Cidercade Dallas',
      notes: 'Official site says nearly 200 games.',
      verifiedByCount: 5,
    });
    expect(details?.gamesById.mvc2).toMatchObject({
      categories: ['Fighting'],
      title: 'Marvel vs. Capcom 2',
    });
  });
});
