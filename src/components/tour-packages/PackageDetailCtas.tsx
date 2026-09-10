'use client';

import { useModal } from '@/components/modals/modal-context';
import { Button } from '@/components/ui/button';

export interface PackageDetailCtasProps {
  packageName: string;
}

/**
 * BLOCKERS.md Decision D: "Enquire Now" / "Download Brochure" CTAs on the
 * package detail page, opening the shared modals with
 * `{ label: 'Package', value: <this package name> }` context — never
 * re-asking the visitor what they already clicked (product-spec §4).
 */
export function PackageDetailCtas({ packageName }: PackageDetailCtasProps) {
  const { openEnquiry, openBrochure } = useModal();
  const context = { label: 'Package', value: packageName };

  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="primary" onClick={() => openEnquiry(context)}>
        Enquire Now <span aria-hidden="true">→</span>
      </Button>
      <Button type="button" variant="default" onClick={() => openBrochure(context)}>
        Download Brochure <span aria-hidden="true">↓</span>
      </Button>
    </div>
  );
}
