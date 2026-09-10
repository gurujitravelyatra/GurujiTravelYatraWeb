'use client';

import { LeadModal } from './LeadModal';
import { useModal } from './modal-context';

/**
 * Thin wrapper — tech spec §4.3. Reads the shared modal-context state and
 * renders open only when the currently-open modal is the enquiry variant.
 * Mount once (alongside `<BrochureModal />`) near the app root, inside
 * `<ModalProvider>`.
 */
export function EnquiryModal() {
  const { modal, close } = useModal();
  const isOpen = modal?.variant === 'enquiry';

  return <LeadModal variant="enquiry" open={isOpen} context={isOpen ? modal?.context : undefined} onClose={close} />;
}
