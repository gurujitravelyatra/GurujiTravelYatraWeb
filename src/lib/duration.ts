/**
 * The CRM sends `durationDays`/`durationNights` as separate integers
 * (`CrmTourCard`), not the pre-formatted "9 Days 8 Nights" string the
 * fixture/database era stored. This is the one place that joins them back
 * into display text.
 */
export function formatTourDuration(days: number, nights: number): string {
  const dayWord = days === 1 ? 'Day' : 'Days';
  const nightWord = nights === 1 ? 'Night' : 'Nights';
  return `${days} ${dayWord} ${nights} ${nightWord}`;
}
