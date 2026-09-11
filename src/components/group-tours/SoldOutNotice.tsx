/**
 * Sold-out state for a `GroupDeparture` card — product-spec §5.10's own
 * example pattern for a "tour sold out" supporting state, quoted verbatim:
 *
 *   "This journey is currently full."
 *   "Explore Other Group Tours →"
 *
 * Renders in place of the "Reserve a Seat" CTA whenever
 * `GroupDeparture.isSoldOut` is true (fixture: the "Kashi · Ayodhya ·
 * Prayagraj" departure) — see `GroupDepartureCard`. The link is a genuine
 * in-page anchor back to the departures list heading (`#upcoming-group-tours`,
 * set on the `<h2>` in `GroupDeparturesList`), not a fabricated destination:
 * the visitor is already on the page listing every other group tour, so
 * "explore other group tours" means "look at the rest of this list."
 */
export function SoldOutNotice() {
  return (
    <p className="max-w-[220px] text-right text-13 leading-[1.5] text-gty-body">
      <strong className="block text-13-5 font-bold text-gty-ink">This journey is currently full.</strong>
      <a
        href="#upcoming-group-tours"
        className="font-bold text-gty-primary transition-colors duration-gty-fast ease-gty hover:text-gty-primary-deep hover:underline"
      >
        Explore Other Group Tours <span aria-hidden="true">→</span>
      </a>
    </p>
  );
}
