/**
 * Generic calendar months for the "Travel Month" select — a plain calendar
 * fact, not business data, so it needs no source in the design export or
 * fixtures (unlike prices, seat counts, or per-night rates, which would have
 * to be invented). "Any month" (rendered as the select's own default option
 * in `TripPreferencesStep`) represents "no preference" and is real, working
 * copy — not a placeholder.
 */
export const TRAVEL_MONTHS: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Special-requests textarea cap — matches the export's own "0/500" counter (line 660). */
export const SPECIAL_REQUESTS_MAX_LENGTH = 500;
