import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatDistanceMiles,
  formatVerificationAge,
  formatVerificationDate,
} from './format';

describe('formatDistanceMiles', () => {
  it('keeps one decimal place for short distances', () => {
    expect(formatDistanceMiles(4.24)).toBe('4.2 mi');
  });

  it('rounds longer distances', () => {
    expect(formatDistanceMiles(24.6)).toBe('25 mi');
  });
});

describe('verification formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats recent verification ages', () => {
    expect(formatVerificationAge('2026-04-27T08:00:00Z')).toBe(
      'verified today',
    );
    expect(formatVerificationAge('2026-04-26T08:00:00Z')).toBe(
      'verified 1 day ago',
    );
    expect(formatVerificationAge('2026-04-20T08:00:00Z')).toBe(
      'verified 7 days ago',
    );
  });

  it('formats older verification ages by month', () => {
    expect(formatVerificationAge('2026-03-01T08:00:00Z')).toBe(
      'verified 1 month ago',
    );
    expect(formatVerificationAge('2026-01-01T08:00:00Z')).toBe(
      'verified 3 months ago',
    );
  });

  it('formats verification dates for display', () => {
    expect(formatVerificationDate('2026-04-14T08:00:00Z')).toBe(
      'Apr 14, 2026',
    );
  });
});
