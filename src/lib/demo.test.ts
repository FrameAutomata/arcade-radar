import { describe, expect, it } from 'vitest';

import {
  buildDemoSearchParams,
  buildExpoAliasUrl,
  defaultDemoAlias,
  featuredDemoSearches,
} from './demo';

describe('demo deployment helpers', () => {
  it('builds stable EAS alias URLs', () => {
    expect(buildExpoAliasUrl('demo')).toBe(
      'https://arcade-radar--demo.expo.app/',
    );
    expect(buildExpoAliasUrl(' staging ')).toBe(
      'https://arcade-radar--staging.expo.app/',
    );
    expect(buildExpoAliasUrl('')).toBe(
      `https://arcade-radar--${defaultDemoAlias}.expo.app/`,
    );
  });
});

describe('featuredDemoSearches', () => {
  it('contains QR-demo-ready searches with location and game params', () => {
    expect(featuredDemoSearches.length).toBeGreaterThanOrEqual(3);

    for (const search of featuredDemoSearches) {
      expect(search.title).not.toHaveLength(0);
      expect(search.game).not.toHaveLength(0);
      expect(search.location).toMatch(/^\d{5}$/);
      expect(buildDemoSearchParams(search)).toEqual({
        game: search.game,
        location: search.location,
      });
    }
  });
});
