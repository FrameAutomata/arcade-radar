import { describe, expect, it } from 'vitest';

import { getScoutErrorMessage } from './scout';

describe('getScoutErrorMessage', () => {
  it('returns plain string errors', () => {
    expect(getScoutErrorMessage('Already submitted')).toBe('Already submitted');
  });

  it('prefers structured error messages', () => {
    expect(getScoutErrorMessage({ message: 'Authentication required' })).toBe(
      'Authentication required',
    );
  });

  it('falls back to details when message is missing', () => {
    expect(getScoutErrorMessage({ details: 'Duplicate pending report' })).toBe(
      'Duplicate pending report',
    );
  });

  it('serializes unknown objects as a last resort', () => {
    expect(getScoutErrorMessage({ code: 'P0001' })).toBe('{"code":"P0001"}');
  });
});
