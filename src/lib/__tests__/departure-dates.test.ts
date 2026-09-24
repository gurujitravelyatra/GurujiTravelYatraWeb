import { groupDepartures } from '@/content/fixtures/group-departures.fixture';

import {
  departureMonthKey,
  departureMonthKeys,
  departureMonthOf,
  formatDepartureDateRange,
  isOrderedRange,
  parseDepartureDateRange,
  parseIsoDate,
} from '../departure-dates';

describe('formatDepartureDateRange', () => {
  it('writes a same-month range in the export’s own shape, days zero-padded', () => {
    expect(formatDepartureDateRange('2026-05-12', '2026-05-18')).toBe('12 — 18 May 2026');
    expect(formatDepartureDateRange('2026-10-06', '2026-10-15')).toBe('06 — 15 Oct 2026');
  });

  it('names both months for a range that crosses a month', () => {
    expect(formatDepartureDateRange('2026-05-28', '2026-06-03')).toBe('28 May — 03 Jun 2026');
  });

  it('names both years for a range that crosses a year', () => {
    expect(formatDepartureDateRange('2026-12-28', '2027-01-04')).toBe('28 Dec 2026 — 04 Jan 2027');
  });

  it('allows a single-day departure', () => {
    expect(formatDepartureDateRange('2026-05-12', '2026-05-12')).toBe('12 — 12 May 2026');
  });

  it('refuses an end before the start, and an impossible date', () => {
    expect(() => formatDepartureDateRange('2026-05-18', '2026-05-12')).toThrow();
    expect(() => formatDepartureDateRange('2026-02-30', '2026-03-02')).toThrow();
  });
});

describe('parseDepartureDateRange — the exact inverse of the formatter', () => {
  it.each([
    ['2026-05-12', '2026-05-18'],
    ['2026-05-28', '2026-06-03'],
    ['2026-12-28', '2027-01-04'],
    ['2028-02-29', '2028-03-01'],
  ])('round-trips %s — %s', (start, end) => {
    expect(parseDepartureDateRange(formatDepartureDateRange(start, end))).toEqual({ start, end });
  });

  /**
   * THE property that makes the editor safe to use on seeded rows: every stored
   * label parses and re-formats to the IDENTICAL string. If this failed, saving
   * an unrelated field of a seeded tour would silently rewrite a departure's
   * public date label.
   */
  it('every seeded fixture label parses and re-formats to the identical string', () => {
    expect(groupDepartures.length).toBeGreaterThanOrEqual(4);
    for (const departure of groupDepartures) {
      const range = parseDepartureDateRange(departure.dateRangeLabel);
      expect(range).toBeDefined();
      expect(formatDepartureDateRange(range!.start, range!.end)).toBe(departure.dateRangeLabel);
      // …and the derived month key matches the stored `month` column.
      expect(departureMonthOf(range!.start)).toBe(departure.month);
    }
  });

  it('returns undefined for free text rather than guessing a date', () => {
    for (const label of ['mid-May, TBC', '12 - 18 May 2026', '12 — 18 May', '31 — 32 May 2026', '18 — 12 May 2026', '']) {
      expect(parseDepartureDateRange(label)).toBeUndefined();
    }
  });
});

describe('parseIsoDate / isOrderedRange', () => {
  it('accepts only real calendar dates in YYYY-MM-DD', () => {
    expect(parseIsoDate('2026-05-12')).toEqual({ year: 2026, month: 5, day: 12 });
    for (const bad of ['2026-5-12', '2026-13-01', '2026-02-29', '12-05-2026', '2026-05-12T00:00:00Z', '']) {
      expect(parseIsoDate(bad)).toBeUndefined();
    }
  });

  it('orders ranges', () => {
    expect(isOrderedRange('2026-05-12', '2026-05-18')).toBe(true);
    expect(isOrderedRange('2026-05-18', '2026-05-12')).toBe(false);
  });
});

describe('month chip keys', () => {
  it('carries the departure’s own year, so a 2027 batch is not filed under 2026', () => {
    expect(departureMonthKey({ dateRangeLabel: '04 — 10 Jan 2027', month: 'Jan' })).toBe('Jan 2027');
  });

  it('falls back to the bare month column for a label it cannot read — never inventing a year', () => {
    expect(departureMonthKey({ dateRangeLabel: 'TBC', month: 'Jun' })).toBe('Jun');
  });

  it('is one key per month with a departure, in calendar order across years', () => {
    const keys = departureMonthKeys([
      { dateRangeLabel: '04 — 10 Jan 2027', month: 'Jan' },
      { dateRangeLabel: '06 — 15 Oct 2026', month: 'Oct' },
      { dateRangeLabel: '12 — 18 May 2026', month: 'May' },
      { dateRangeLabel: '20 — 25 May 2026', month: 'May' },
    ]);
    expect(keys).toEqual(['May 2026', 'Oct 2026', 'Jan 2027']);
  });
});
