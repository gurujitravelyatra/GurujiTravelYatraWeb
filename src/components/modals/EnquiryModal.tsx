'use client';

import { LeadModal } from './LeadModal';
import { useModal } from './modal-context';

/**
 * Thin wrapper — tech spec §4.3. Reads the shared modal-context state and
 * renders open only when the currently-open modal is the enquiry variant.
 * Mount once (alongside `<BrochureModal />`) near the app root, inside
 * `<ModalProvider>`.
 *
 * This variant now backs THREE `formType`s, not one: a plain enquiry, a group
 * tour reservation and a custom trip request all use the enquiry modal's copy
 * and field set, because all three need the same thing from the visitor (name,
 * mobile, and nothing they have already told the page). `details` is what
 * distinguishes them at submit time; it is simply forwarded, never interpreted
 * here.
 */
export function EnquiryModal() {
  const { modal, close } = useModal();
  const isOpen = modal?.variant === 'enquiry';

  return (
    <LeadModal
      variant="enquiry"
      open={isOpen}
      context={isOpen ? modal?.context : undefined}
      details={isOpen ? modal?.details : undefined}
      onClose={close}
    />
  );
}
