'use client';

import { LeadModal } from './LeadModal';
import { useModal } from './modal-context';

/**
 * Thin wrapper — tech spec §4.3. Reads the shared modal-context state and
 * renders open only when the currently-open modal is the brochure variant.
 * Mount once (alongside `<EnquiryModal />`) near the app root, inside
 * `<ModalProvider>`.
 */
export function BrochureModal() {
  const { modal, close } = useModal();
  const isOpen = modal?.variant === 'brochure';

  return (
    <LeadModal
      variant="brochure"
      open={isOpen}
      context={isOpen ? modal?.context : undefined}
      details={isOpen ? modal?.details : undefined}
      onClose={close}
    />
  );
}
