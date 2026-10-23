/**
 * Rupee amounts — the ONE place their written form is defined. M6 of the
 * 2026-09-19 independent review.
 *
 * `priceFrom` and `priceWas` are stored as display strings ("₹42,500"), because
 * that is what the design export and every card render. Until this module they
 * were free text: the admin could type `42500`, `Rs 42,500`, `₹42,500 pp` or
 * `on request`, and each of those rendered verbatim on a public card while
 * `getPriceRange()` stripped non-digits and read `₹42,500 per 2 pax` as
 * ₹4,25,002 — a price range built from a number nobody wrote.
 *
 * Zero dependencies and not `server-only`: the tour form imports this in the
 * browser, and the schema that uses it runs on both sides.
 */

/**
 * The canonical written form: a rupee sign, then digits in INDIAN grouping —
 * the last group three digits, every earlier group two. `₹999`, `₹42,500`,
 * `₹1,20,000`. Nothing else: no space, no decimals, no suffix.
 *
 * Strict rather than normalising, for the reason `SLUG_PATTERN` gives: this is
 * text a visitor reads, and silently rewriting what the admin typed is how the
 * page ends up saying something they did not write.
 */
export const RUPEE_AMOUNT_PATTERN = /^₹(?:[1-9]\d{0,2}|[1-9]\d?(?:,\d{2})*,\d{3})$/;

export const RUPEE_FORMAT_MESSAGE = 'Write the price as a rupee amount, e.g. ₹42,500 or ₹1,20,000.';

/** `₹42,500` → `42500`. `undefined` for anything that is not in the canonical form. */
export function parseRupeeAmount(value: string): number | undefined {
  if (!RUPEE_AMOUNT_PATTERN.test(value)) return undefined;
  return Number(value.slice(1).replace(/,/g, ''));
}

/**
 * Tolerant reading for STORED values — used by public read paths, never by
 * validation.
 *
 * Rows written before M6 (the 22 seeded tours, and anything an admin saved
 * earlier) were never checked, and this pass deliberately does not rewrite
 * published rows. So a reader must survive `₹42500` or `₹ 42,500` — and must
 * return `undefined` rather than a fabricated number for `₹42,500 pp` or
 * `on request`. The rule: after removing the rupee sign, whitespace and
 * commas, what is left must be digits and nothing else.
 */
export function readStoredRupeeAmount(value: string | undefined | null): number | undefined {
  if (typeof value !== 'string') return undefined;
  const bare = value.replace(/^\s*₹/, '').replace(/[\s,]/g, '');
  if (!/^\d+$/.test(bare)) return undefined;
  const amount = Number(bare);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : undefined;
}

/**
 * `120000` → `1,20,000`. Written out rather than `toLocaleString('en-IN')`,
 * because that depends on the runtime shipping full ICU data, and a Node built
 * with `small-icu` silently produces `120,000` — a Western grouping on an Indian
 * price.
 */
export function groupIndian(amount: number): string {
  const digits = String(Math.trunc(Math.abs(amount)));
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

export function formatRupees(amount: number): string {
  return `₹${groupIndian(amount)}`;
}

/**
 * The "Save ₹X" figure, DERIVED — never typed.
 *
 * Returns the saving as the pill renders it (digits only; the component adds
 * `Save ₹`), or `undefined` when there is no genuine saving to claim: either
 * price missing, either one non-canonical, or the "was" price not above the
 * current one. A hand-typed savings label could disagree with the two prices
 * printed right beside it, which is a fabricated discount by arithmetic.
 */
export function deriveSavingsLabel(priceFrom: string | undefined, priceWas: string | undefined): string | undefined {
  if (!priceFrom || !priceWas) return undefined;
  const from = parseRupeeAmount(priceFrom);
  const was = parseRupeeAmount(priceWas);
  if (from === undefined || was === undefined || was <= from) return undefined;
  return groupIndian(was - from);
}

/**
 * True when `priceFrom` is a real, positive, readable amount a card may
 * quote — CRM-migration decision 1.
 *
 * `public-listing.ts` no longer withholds a whole tour for an unconfirmed
 * price (the CRM's own `isLiveOnWebsite` publish gate, which already refuses
 * to publish a tour with no price above zero, is trusted fully instead). But
 * trusting the publish gate is not the same as trusting every individual
 * price string: if a price ever arrives missing, empty or reading as zero —
 * today only reachable via a hand-edited row, tomorrow via a CRM response
 * with `price: null` or `{ amount: 0 }` — the site must never print "₹0" or
 * a blank figure. `readStoredRupeeAmount` already treats anything that is
 * not a real positive number (missing, empty, zero, or unparseable text) as
 * absent, which is exactly the boundary this needs.
 *
 * Callers render `PriceOnRequest` (`@/components/ui/price-on-request`)
 * instead of the price whenever this is `false`.
 */
export function hasConfirmedTourPrice(priceFrom: string | undefined): boolean {
  return readStoredRupeeAmount(priceFrom) !== undefined;
}
