'use client';

const TRIP_COST_NOTE_ID = 'ct-trip-cost-note';

export interface TripSummaryCardProps {
  totalStops: number;
  tripHeadline: string;
  tripRouteLabel: string;
  travelStyleLabel: string;
  travelMonthLabel: string;
  travellersLabel: string;
  onGetQuote: () => void;
  whatsappHref: string;
}

/**
 * Export lines 668-686 ("Your Trip So Far"). The export derives an "Estimated
 * Cost (Per Person)" figure as `nights * (3200|5400|8600)` (line 1157) — those
 * per-night rates appear in no spec, price list or fixture (places.fixture.ts
 * doc comment), so showing a number computed from them would be a fabricated
 * price quote. The row stays (it's part of the design) but its value is
 * marked unconfirmed with the same asterisk + `aria-describedby` footnote
 * treatment `StatsBar`/`WhyGtyBand` use for unconfirmed figures — here it
 * points at the card's own existing disclaimer line rather than duplicating
 * copy, since that line already explains why no price is shown yet.
 *
 * Travel Month / Travellers rows show the real, live values from the builder
 * (task brief: these are now genuinely wired), unlike the export which always
 * rendered "—" for both (it never tracked them).
 */
export function TripSummaryCard({
  totalStops,
  tripHeadline,
  tripRouteLabel,
  travelStyleLabel,
  travelMonthLabel,
  travellersLabel,
  onGetQuote,
  whatsappHref,
}: TripSummaryCardProps) {
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-18 p-6 shadow-gty-md"
      style={{ background: 'linear-gradient(180deg,#fef4f3 0%,#fdeceb 100%)' }}
    >
      <div className="flex items-center gap-[10px]">
        <span aria-hidden="true" className="flex flex-none text-gty-primary">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" className="flex-none">
            <path d="M9 3h6v2h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3V3zm2 2v1h2V5h-2z" />
          </svg>
        </span>
        <span className="text-12 font-extrabold uppercase tracking-eyebrow-2 text-gty-subtle">Your trip so far</span>
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-[14px] rotate-[-6deg] text-center font-script text-21 leading-[1.1] text-gty-primary"
      >
        Almost There!
        <span className="block text-19">&#8600;</span>
      </span>

      <div className="mt-[18px] flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-[66px] w-[66px] flex-none items-center justify-center rounded-pill bg-gty-white text-gty-faint shadow-gty-soft"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="flex-none">
            <path d="M12 2c3.9 0 7 3.1 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-3.9 3.1-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <span className="text-23 leading-[1.1] text-gty-ink">{tripHeadline}</span>
          <span className="text-13 leading-[1.5] text-gty-muted">{tripRouteLabel}</span>
        </span>
      </div>

      <div className="my-5 border-t border-dashed border-gty-red-400" />

      <dl role="group" aria-label="Your trip summary" aria-describedby={TRIP_COST_NOTE_ID} className="flex flex-col gap-[14px]">
        <SummaryRow label="Total Stops">{totalStops}</SummaryRow>
        <SummaryRow label="Travel Style">{travelStyleLabel}</SummaryRow>
        <SummaryRow label="Estimated Cost (Per Person)">
          On request
          <span aria-hidden="true" data-testid="trip-cost-placeholder-marker" className="align-super text-11 font-bold text-gty-muted">
            *
          </span>
        </SummaryRow>
        <SummaryRow label="Travel Month">{travelMonthLabel}</SummaryRow>
        <SummaryRow label="Travellers">{travellersLabel}</SummaryRow>
      </dl>

      <button
        type="button"
        onClick={onGetQuote}
        className="mt-5 inline-flex items-center justify-center gap-[10px] rounded-pill border-[1.5px] border-gty-primary bg-gty-primary px-6 py-4 text-14-5 font-bold text-gty-white shadow-gty-red-md transition-[background-color,transform] duration-gty-fast ease-gty hover:-translate-y-px hover:bg-gty-primary-deep"
      >
        Get My Custom Quote <span aria-hidden="true">→</span>
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center justify-center gap-[10px] rounded-pill border border-gty-border-7 bg-gty-white px-6 py-[15px] text-14-5 font-bold text-gty-ink transition-colors duration-gty-fast ease-gty hover:border-gty-whatsapp"
      >
        <svg viewBox="0 0 32 32" width="19" height="19" fill="#25d366" aria-hidden="true" className="flex-none">
          <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm7.3 18.2c-.3.9-1.8 1.7-2.5 1.8-.6.1-1.4.1-2.3-.2-3.6-1.2-6-4.7-6.2-4.9-.2-.3-1.5-2-1.5-3.9s1-2.8 1.3-3.2c.3-.4.7-.5 1-.5h.7c.2 0 .5 0 .8.6l1 2.4c.1.2.1.4 0 .6l-.4.7c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 1.7 1.3 2 1.4.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2.3 1.1c.3.2.5.3.5.5.1.2.1.9-.4 1.6z" />
        </svg>
        Send Route on WhatsApp <span aria-hidden="true">→</span>
      </a>

      <div className="mt-4 flex items-start gap-[10px]">
        <span aria-hidden="true" className="flex flex-none pt-[1px] text-gty-primary">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" className="flex-none">
            <path d="M12 2l8 3v6.5c0 5-3.4 8.6-8 10.5-4.6-1.9-8-5.5-8-10.5V5l8-3z" />
          </svg>
        </span>
        <p id={TRIP_COST_NOTE_ID} className="text-12-5 leading-[1.55] text-gty-muted">
          A GTY planner will confirm hotels, transport and the final price before anything is booked.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-13-5 text-gty-ink-soft">{label}</dt>
      <dd className="text-13-5 font-bold text-gty-ink">{children}</dd>
    </div>
  );
}
