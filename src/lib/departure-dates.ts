/**
 * Departure date ranges — the ONE place their written form is defined.
 * Added 2026-09-25 with the admin departures editor.
 *
 * `GroupDeparture.dateRangeLabel` is stored as display text ("12 — 18 May
 * 2026"), because that is what the design export transcribed and what every
 * card, lead payload and log line already carries. Until the admin could write
 * departures it was only ever copied verbatim from the export, so nothing
 * needed to define its shape.
 *
 * The admin form now collects two real calendar dates and this module turns
 * them into the label — so an admin cannot type "mid-May, TBC" into the field a
 * visitor reads as a confirmed departure, and the `month` chip key is DERIVED
 * from the start date rather than typed separately and left to disagree with it.
 * Same discipline as `rupees.ts` (M6): strict on write, one written form, and
 * the parser only accepts what the formatter produces.
 *
 * No schema change was needed: the label and `month` columns keep their
 * meaning and shape, the 4 seeded labels already parse, and each re-formats to
 * the identical string (`departure-dates.test.ts` asserts that for every
 * fixture row, so an unrelated tour save cannot rewrite a seeded label).
 *
 * Zero dependencies and not `server-only` — the tour form imports it in the
 * browser, and the public chip row uses it too. Every calculation is on the
 * calendar date as written (UTC), never local time, so a server in one zone and
 * a browser in another cannot disagree about which day a batch leaves.
 */

export const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export type MonthAbbreviation = (typeof MONTH_ABBREVIATIONS)[number];

/** `YYYY-MM-DD`, the value an `<input type="date">` submits. */
export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

function isRealDate({ year, month, day }: CalendarDate): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the NEXT month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** `2026-05-12` → its parts, or `undefined` for anything that is not a real calendar date. */
export function parseIsoDate(value: string): CalendarDate | undefined {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return undefined;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isRealDate(date) ? date : undefined;
}

function toIso({ year, month, day }: CalendarDate): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function compare(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** True when `end` is on or after `start`. Both must already be valid ISO dates. */
export function isOrderedRange(start: string, end: string): boolean {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  return a !== undefined && b !== undefined && compare(a, b) <= 0;
}

const pad = (day: number) => String(day).padStart(2, '0');
const mon = (month: number) => MONTH_ABBREVIATIONS[month - 1];

/**
 * Two ISO dates → the label, in the export's own shape.
 *
 *  - same month:  `12 — 18 May 2026`        (the only shape in the seeded data)
 *  - same year:   `28 May — 03 Jun 2026`
 *  - across years: `28 Dec 2026 — 04 Jan 2027`
 *
 * Days are zero-padded (`06 — 15 Oct 2026`) because the export pads them, so a
 * seeded label and an admin-written one are indistinguishable on the page.
 * Throws on invalid input: callers validate first, and a malformed label reaching
 * a public card is worse than a failed save.
 */
export function formatDepartureDateRange(start: string, end: string): string {
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  if (!a || !b || compare(a, b) > 0) {
    throw new Error(`formatDepartureDateRange: not a valid ordered range: "${start}" — "${end}"`);
  }
  if (a.year === b.year && a.month === b.month) return `${pad(a.day)} — ${pad(b.day)} ${mon(a.month)} ${a.year}`;
  if (a.year === b.year) return `${pad(a.day)} ${mon(a.month)} — ${pad(b.day)} ${mon(b.month)} ${a.year}`;
  return `${pad(a.day)} ${mon(a.month)} ${a.year} — ${pad(b.day)} ${mon(b.month)} ${b.year}`;
}

const MON = MONTH_ABBREVIATIONS.join('|');
const SAME_MONTH = new RegExp(`^(\\d{2}) — (\\d{2}) (${MON}) (\\d{4})$`);
const SAME_YEAR = new RegExp(`^(\\d{2}) (${MON}) — (\\d{2}) (${MON}) (\\d{4})$`);
const CROSS_YEAR = new RegExp(`^(\\d{2}) (${MON}) (\\d{4}) — (\\d{2}) (${MON}) (\\d{4})$`);

const monthNumber = (abbreviation: string) => MONTH_ABBREVIATIONS.indexOf(abbreviation as MonthAbbreviation) + 1;

/**
 * A stored label → the two ISO dates, or `undefined`.
 *
 * Accepts EXACTLY the three shapes `formatDepartureDateRange` writes — the
 * inverse of the formatter and nothing more. Used to pre-fill the admin form's
 * date inputs from a stored row. A label in any other shape returns `undefined`
 * and the form asks for the dates to be entered, rather than guessing what a
 * free-text label meant and writing that guess back as a confirmed date.
 */
export function parseDepartureDateRange(label: string): { start: string; end: string } | undefined {
  let a: CalendarDate;
  let b: CalendarDate;

  const same = SAME_MONTH.exec(label);
  const year = SAME_YEAR.exec(label);
  const cross = CROSS_YEAR.exec(label);

  if (same) {
    const m = monthNumber(same[3]);
    a = { year: Number(same[4]), month: m, day: Number(same[1]) };
    b = { year: Number(same[4]), month: m, day: Number(same[2]) };
  } else if (year) {
    a = { year: Number(year[5]), month: monthNumber(year[2]), day: Number(year[1]) };
    b = { year: Number(year[5]), month: monthNumber(year[4]), day: Number(year[3]) };
  } else if (cross) {
    a = { year: Number(cross[3]), month: monthNumber(cross[2]), day: Number(cross[1]) };
    b = { year: Number(cross[6]), month: monthNumber(cross[5]), day: Number(cross[4]) };
  } else {
    return undefined;
  }

  if (!isRealDate(a) || !isRealDate(b) || compare(a, b) > 0) return undefined;
  return { start: toIso(a), end: toIso(b) };
}

/** The `month` column's value for a batch starting on `start`: `"May"`. */
export function departureMonthOf(start: string): MonthAbbreviation {
  const date = parseIsoDate(start);
  if (!date) throw new Error(`departureMonthOf: not a valid date: "${start}"`);
  return MONTH_ABBREVIATIONS[date.month - 1];
}

/**
 * The public month-chip key for a departure: `"May 2026"`.
 *
 * The chip row used to render `${month} 2026` — a hard-coded year, harmless
 * while every departure came from one 2026 export and false the first time an
 * admin adds a 2027 batch (it would be filed under, and labelled, "Jan 2026").
 * The year now comes from the departure's own label. A label that does not
 * parse falls back to the bare `month` column, so an unrecognised row is still
 * filterable and is never assigned a year it does not state.
 */
export function departureMonthKey(departure: { dateRangeLabel: string; month: string }): string {
  const range = parseDepartureDateRange(departure.dateRangeLabel);
  if (!range) return departure.month;
  const start = parseIsoDate(range.start)!;
  return `${mon(start.month)} ${start.year}`;
}

/**
 * The chip keys for a set of departures — one per month that actually has a
 * departure, in calendar order.
 *
 * DERIVED from the departures passed in, which on `/group-tours` are the ones
 * the public gate let through. So a month whose only batch was withheld (its
 * tour archived) loses its chip too, instead of offering a filter that empties
 * the page — the rule BLOCKERS.md Decision C set for the package chips.
 */
export function departureMonthKeys(departures: readonly { dateRangeLabel: string; month: string }[]): string[] {
  const rank = (key: string): number => {
    const [abbreviation, yearText] = key.split(' ');
    const month = monthNumber(abbreviation);
    // Year-less fallback keys sort after every dated one, in month order.
    const year = yearText ? Number(yearText) : 9999;
    return year * 100 + (month > 0 ? month : 99);
  };

  return Array.from(new Set(departures.map(departureMonthKey))).sort((a, b) => rank(a) - rank(b));
}
