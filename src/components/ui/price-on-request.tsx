import { GTY_PHONE_DISPLAY, GTY_PHONE_TEL, GTY_WHATSAPP_URL } from '@/lib/gty-contact';
import { cn } from '@/lib/utils';

export interface PriceOnRequestProps {
  className?: string;
  /**
   * False on a surface that is ALREADY an `<a>`/link — `PackageCard` wraps
   * its entire card in one `<Link>` to the detail page (BLOCKERS.md Decision
   * E keeps every other element in that card non-interactive for exactly
   * this reason: a nested `<a>` is invalid DOM and browsers resolve the
   * click unpredictably). On such a surface this renders the call/WhatsApp
   * facts as plain text instead of live links; the detail page itself
   * (which is NOT inside another link) renders the real, clickable CTA.
   * Defaults to `true`.
   */
  interactive?: boolean;
}

/**
 * CRM-migration decision 1's rider.
 *
 * `public-listing.ts` no longer withholds a tour for an unconfirmed price —
 * the CRM's own `isLiveOnWebsite` publish gate is trusted fully instead. The
 * one thing that must never happen as a result is printing "₹0" or a blank
 * figure for a price that arrives missing or reads as zero
 * (`hasConfirmedTourPrice()` in `@/lib/rupees` is the check every price
 * render site runs before deciding between the real figure and this
 * component).
 *
 * Renders a real call-to-action rather than a dead end: the same confirmed
 * phone/WhatsApp contact facts every other CTA on the site uses
 * (`@/lib/gty-contact`), never an invented "contact us" with no way to
 * actually do it.
 */
export function PriceOnRequest({ className, interactive = true }: PriceOnRequestProps) {
  const contactLine = (
    <>
      Call {GTY_PHONE_DISPLAY} <span aria-hidden="true">·</span> WhatsApp us
    </>
  );

  return (
    <span className={cn('flex flex-col gap-[3px]', className)}>
      <span className="text-18 font-extrabold text-gty-primary">Price on request</span>
      {interactive ? (
        <span className="flex flex-wrap items-center gap-[6px] text-12-5 font-semibold text-gty-body">
          <a
            href={`tel:${GTY_PHONE_TEL}`}
            className="underline decoration-gty-border-9 underline-offset-2 transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
          >
            Call {GTY_PHONE_DISPLAY}
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={GTY_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-gty-border-9 underline-offset-2 transition-colors duration-gty-fast ease-gty hover:text-gty-primary"
          >
            WhatsApp us
          </a>
        </span>
      ) : (
        <span className="text-12-5 font-semibold text-gty-body">{contactLine}</span>
      )}
    </span>
  );
}
