import { describe, expect, it } from 'vitest';

import { buildMapRegion, distanceInMiles } from './geo';

describe('distanceInMiles', () => {
  it('returns zero for identical coordinates', () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };

    expect(distanceInMiles(dallas, dallas)).toBeCloseTo(0, 5);
  });

  it('calculates approximate DFW distances', () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };
    const fortWorth = { latitude: 32.7555, longitude: -97.3308 };

    expect(distanceInMiles(dallas, fortWorth)).toBeGreaterThan(30);
    expect(distanceInMiles(dallas, fortWorth)).toBeLessThan(35);
  });
});

describe('buildMapRegion', () => {
  it('centers around nearby points and ignores very distant outliers', () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };
    const arlington = { latitude: 32.7357, longitude: -97.1081 };
    const seattle = { latitude: 47.6062, longitude: -122.3321 };

    const region = buildMapRegion(dallas, [arlington, seattle], 100);

    expect(region.latitude).toBeCloseTo(32.7562, 3);
    expect(region.longitude).toBeCloseTo(-96.95255, 3);
    expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.128);
    expect(region.longitudeDelta).toBeGreaterThan(0.4);
  });
});
