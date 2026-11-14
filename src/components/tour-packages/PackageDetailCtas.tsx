'use client';

import type { CrmCategory } from '@/server/crm/types';
import { useModal } from '@/components/modals/modal-context';
import { Button } from '@/components/ui/button';

export interface PackageDetailCtasProps {
  packageName: string;
  /** `CrmTourDetail.slug` — threaded through so the CRM lead lands on this exact tour (`CrmEnquiryRequest.tourSlug`), not just a display string. */
  slug: string;
  /** `CrmTourCard.hasBrochure` — hides the button entirely rather than opening a flow for a brochure that does not exist. */
  hasBrochure: boolean;
  /** Drives the primary CTA's label — see the component header. */
  category: CrmCategory;
}

/**
 * "Enquire Now"/"Plan This Trip" + "Download Brochure" CTAs on the tour
 * detail page, opening the shared modals with `{ label: 'Package', value:
 * <this tour name>, tourSlug: <this tour's slug> }` context — never
 * re-asking the visitor what they already clicked.
 *
 * CRM-migration Step 2: "Download Brochure" is now conditional on
 * `hasBrochure`. It used to render unconditionally regardless of whether a
 * real PDF existed.
 *
 * User decision (2026-11-14, Trip Finder business rules, item 1): a
 * non-Group tour has no fixed departure to "enquire" about yet — hotels and
 * tickets are only confirmed after the visitor reaches out — so its
 * primary CTA reads "Plan This Trip" instead of "Enquire Now". Both open
 * the exact same enquiry modal; only the label differs.
 */
export function PackageDetailCtas({ packageName, slug, hasBrochure, category }: PackageDetailCtasProps) {
  const { openEnquiry, openBrochure } = useModal();
  const context = { label: 'Package', value: packageName, tourSlug: slug };
  const primaryLabel = category === 'Group' ? 'Enquire Now' : 'Plan This Trip';

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="primary" onClick={() => openEnquiry(context)}>
        {primaryLabel} <span aria-hidden="true">→</span>
      </Button>
      {hasBrochure && (
        <Button type="button" variant="default" onClick={() => openBrochure(context)}>
          Download Brochure <span aria-hidden="true">↓</span>
        </Button>
      )}
    </div>
  );
}
