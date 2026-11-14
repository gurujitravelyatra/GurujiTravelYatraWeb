import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnquiryModal } from '../EnquiryModal';
import { ModalProvider, useModal } from '../modal-context';

// CRM-migration Step 3: never load the real Cloudflare script in a test —
// see `src/components/modals/__mocks__/TurnstileWidget.tsx`'s own header.
jest.mock('../TurnstileWidget');

/**
 * New brief (2026-11-15), item 5: "keyboard (Esc closes, focus trapped and
 * returned)". Both mechanisms already existed — Radix's `Dialog` traps
 * focus and closes on Escape by default, and `modal-context.tsx`'s
 * `ModalProvider` already captures/restores focus (BLOCKERS.md §4) — this
 * is the first test to exercise them together through a REAL trigger
 * button, the shape the redesigned popup actually ships in.
 */
function Trigger() {
  const { openEnquiry } = useModal();
  return <button onClick={() => openEnquiry({ label: 'Package', value: 'Spiti Valley Circuit' })}>Enquire Now</button>;
}

function Harness() {
  return (
    <ModalProvider>
      <Trigger />
      <EnquiryModal />
    </ModalProvider>
  );
}

describe('LeadModal — keyboard behaviour', () => {
  it('Escape closes the dialog and returns focus to the trigger that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Enquire Now' });
    await user.click(trigger);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    // `AnimatePresence` + `forceMount` keeps the dialog mounted, fading out,
    // for its own 0.18s exit transition — Radix flips `data-state="closed"`
    // immediately, but the node itself is only removed once that finishes.
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

    expect(trigger).toHaveFocus();
  });

  it('traps focus inside the dialog — Tab never reaches the page behind it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Enquire Now' }));
    const dialog = await screen.findByRole('dialog');

    // Cycle far more tabs than the form has fields — if focus ever escaped
    // the dialog it would land back on the (now hidden) trigger button.
    for (let i = 0; i < 20; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
