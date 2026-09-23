import {
  deriveSavingsLabel,
  formatRupees,
  groupIndian,
  parseRupeeAmount,
  readStoredRupeeAmount,
} from '../rupees';

/** M6 of the 2026-09-19 review — one definition of a written rupee amount. */
describe('parseRupeeAmount — the strict, canonical form the admin must type', () => {
  it.each([
    ['₹999', 999],
    ['₹1,000', 1000],
    ['₹42,500', 42500],
    ['₹1,20,000', 120000],
    ['₹12,34,56,789', 123456789],
  ])('reads %s', (value, expected) => {
    expect(parseRupeeAmount(value)).toBe(expected);
  });

  it.each([
    ['no rupee sign', '42,500'],
    ['ungrouped', '₹42500'],
    ['Western grouping', '₹120,000'],
    ['a space after the sign', '₹ 42,500'],
    ['a suffix', '₹42,500 pp'],
    ['decimals', '₹42,500.00'],
    ['words', 'On request'],
    ['zero', '₹0'],
    ['a leading zero', '₹042,500'],
    ['a negative', '-₹42,500'],
    ['empty', ''],
    ['Rs prefix', 'Rs 42,500'],
  ])('refuses %s', (_label, value) => {
    expect(parseRupeeAmount(value)).toBeUndefined();
  });
});

describe('readStoredRupeeAmount — tolerant, for rows written before the rule', () => {
  it('reads grouping and spacing variants that are still unambiguous', () => {
    expect(readStoredRupeeAmount('₹42,500')).toBe(42500);
    expect(readStoredRupeeAmount('₹42500')).toBe(42500);
    expect(readStoredRupeeAmount(' ₹ 1,20,000 ')).toBe(120000);
  });

  it('returns nothing — never a fabricated number — for a value with other text', () => {
    // The old reader stripped non-digits: this became 4,25,002.
    expect(readStoredRupeeAmount('₹42,500 per 2 pax')).toBeUndefined();
    expect(readStoredRupeeAmount('On request')).toBeUndefined();
    expect(readStoredRupeeAmount('₹42,500.50')).toBeUndefined();
    expect(readStoredRupeeAmount('')).toBeUndefined();
    expect(readStoredRupeeAmount(undefined)).toBeUndefined();
    expect(readStoredRupeeAmount('₹0')).toBeUndefined();
  });
});

describe('Indian digit grouping, independent of the runtime’s ICU data', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1,000'],
    [42500, '42,500'],
    [120000, '1,20,000'],
    [123456789, '12,34,56,789'],
  ])('%d → %s', (amount, expected) => {
    expect(groupIndian(amount)).toBe(expected);
  });

  it('round-trips through the strict parser', () => {
    for (const amount of [1, 999, 1000, 42500, 120000, 9876543]) {
      expect(parseRupeeAmount(formatRupees(amount))).toBe(amount);
    }
  });
});

describe('deriveSavingsLabel — the saving is arithmetic, not an input', () => {
  it('is was − from, in the digits-only form the pill renders', () => {
    expect(deriveSavingsLabel('₹42,500', '₹47,700')).toBe('5,200');
    expect(deriveSavingsLabel('₹98,000', '₹1,10,000')).toBe('12,000');
  });

  it.each([
    ['no was price', '₹42,500', undefined],
    ['no current price', undefined, '₹47,700'],
    ['was equal to current', '₹42,500', '₹42,500'],
    ['was BELOW current', '₹42,500', '₹40,000'],
    ['a non-canonical was price', '₹42,500', '47700'],
  ])('claims no saving with %s', (_label, from, was) => {
    expect(deriveSavingsLabel(from, was)).toBeUndefined();
  });
});
