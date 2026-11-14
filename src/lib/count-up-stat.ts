export interface ParsedCountableStat {
  /** The exact leading digit run as the CRM Owner typed it — "10,000", "8", "150". */
  rawDigits: string;
  /** Numeric value of `rawDigits`, for animating toward. */
  target: number;
  /** Everything after the digit run, verbatim — "+", "", " approx". */
  suffix: string;
}

/**
 * Splits a CRM stat string ("10,000+") into a countable number and its
 * trailing suffix, for the count-up animation (brief §A6/A7, 2026-11-14).
 *
 * Returns `null` for anything that does not start with a digit run — the
 * CRM figure is still an opaque, Owner-typed string (see `Hero`/`WhyGtyBand`'s
 * own "rendered VERBATIM" contract); a value this cannot parse is rendered
 * as plain text by the caller, never thrown on.
 */
export function parseCountableStat(value: string): ParsedCountableStat | null {
  const match = /^([\d,]+)(.*)$/.exec(value.trim());
  if (!match) return null;

  const rawDigits = match[1];
  const digits = rawDigits.replace(/,/g, '');
  if (digits.length === 0) return null;

  const target = Number(digits);
  if (!Number.isFinite(target)) return null;

  return { rawDigits, target, suffix: match[2] };
}
