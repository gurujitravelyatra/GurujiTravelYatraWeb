'use client';

import { useModal } from '@/components/modals/modal-context';
import { Button } from '@/components/ui/button';

export interface PackageDetailCtasProps {
  packageName: string;
  /** `CrmTourCard.hasBrochure` — hides the button entirely rather than opening a flow for a brochure that does not exist. */
  hasBrochure: boolean;
}

/**
 * "Enquire Now" / "Download Brochure" CTAs on the tour detail page, opening
 * the shared modals with `{ label: 'Package', value: <this tour name> }`
 * context — never re-asking the visitor what they already clicked.
 *
 * CRM-migration Step 2: "Download Brochure" is now conditional on
 * `hasBrochure`. It used to render unconditionally regardless of whether a
 * real PDF existed.
 */
export function PackageDetailCtas({ packageName, hasBrochure }: PackageDetailCtasProps) {
  const { openEnquiry, openBrochure } = useModal();
  const context = { label: 'Package', value: packageName };

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="primary" onClick={() => openEnquiry(context)}>
        Enquire Now <span aria-hidden="true">→</span>
      </Button>
      {hasBrochure && (
        <Button type="button" variant="default" onClick={() => openBrochure(context)}>
          Download Brochure <span aria-hidden="true">↓</span>
        </Button>
      )}
    </div>
  );
}
