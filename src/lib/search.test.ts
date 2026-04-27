import { describe, expect, it } from 'vitest';

import {
  demoLocationLabel,
  parseParamString,
  resolveSelectedGame,
  sanitizeCoordinates,
} from './search';

describe('sanitizeCoordinates', () => {
  it('uses valid numeric params', () => {
    expect(sanitizeCoordinates('32.7767', '-96.797')).toEqual({
      latitude: 32.7767,
      longitude: -96.797,
    });
  });

  it('falls back to the DFW demo origin for invalid params', () => {
    expect(sanitizeCoordinates('nope', undefined)).toEqual({
      latitude: 32.7767,
      longitude: -96.797,
    });
    expect(demoLocationLabel).toBe('DFW demo location');
  });
});

describe('parseParamString', () => {
  it('returns only non-empty string params', () => {
    expect(parseParamString('75201')).toBe('75201');
    expect(parseParamString('')).toBeNull();
    expect(parseParamString(['75201'])).toBeNull();
  });
});

describe('resolveSelectedGame', () => {
  it('resolves by explicit game id first', () => {
    expect(resolveSelectedGame('marvel-vs-capcom-2', '')?.title).toBe(
      'Marvel vs. Capcom 2',
    );
  });

  it('resolves by search query when no game id is selected', () => {
    expect(resolveSelectedGame(null, '3rd strike')?.title).toBe(
      'Street Fighter III: 3rd Strike',
    );
  });

  it('returns null when no game can be resolved', () => {
    expect(resolveSelectedGame(null, 'not a real cabinet')).toBeNull();
  });
});
