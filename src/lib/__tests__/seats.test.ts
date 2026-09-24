import { groupDepartures } from '@/content/fixtures/group-departures.fixture';
import { deriveIsSoldOut } from '@/content/sold-out';

import { formatSeatsLabel, parseSeatsInput, readSeatsLabel } from '../seats';

describe('formatSeatsLabel', () => {
  it('writes the export’s own shape, zero-padded', () => {
    expect(formatSeatsLabel(14)).toBe('14 seats left');
    expect(formatSeatsLabel(8)).toBe('08 seats left');
    expect(formatSeatsLabel(1)).toBe('01 seat left');
    expect(formatSeatsLabel(120)).toBe('120 seats left');
  });

  it('writes ZERO as exactly the string sold-out detection reads', () => {
    expect(formatSeatsLabel(0)).toBe('Sold out');
    expect(deriveIsSoldOut(formatSeatsLabel(0))).toBe(true);
    expect(deriveIsSoldOut(formatSeatsLabel(1))).toBe(false);
  });

  it('refuses a negative, fractional or oversized count', () => {
    for (const bad of [-1, 1.5, 1000, Number.NaN]) expect(() => formatSeatsLabel(bad)).toThrow();
  });
});

describe('parseSeatsInput', () => {
  it('accepts whole numbers 0-999 only', () => {
    expect(parseSeatsInput('0')).toBe(0);
    expect(parseSeatsInput('14')).toBe(14);
    expect(parseSeatsInput('999')).toBe(999);
    for (const bad of ['', '-1', '1.5', '1e2', '1000', ' 4', 'four', '0x10']) expect(parseSeatsInput(bad)).toBeUndefined();
  });
});

describe('readSeatsLabel', () => {
  it('reads every seeded fixture label, and re-formats each to the identical string', () => {
    expect(groupDepartures.length).toBeGreaterThanOrEqual(4);
    for (const departure of groupDepartures) {
      const count = readSeatsLabel(departure.seatsLabel);
      expect(count).toBeDefined();
      expect(formatSeatsLabel(count!)).toBe(departure.seatsLabel);
    }
  });

  it('returns undefined for a label it cannot read, rather than guessing a number', () => {
    for (const label of ['Few seats left', 'Filling fast', '']) expect(readSeatsLabel(label)).toBeUndefined();
  });
});
