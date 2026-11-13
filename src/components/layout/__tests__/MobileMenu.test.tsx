import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileMenu } from '../MobileMenu';
import { MobileMenuProvider, useMobileMenu } from '../mobile-menu-context';

const openEnquiry = jest.fn();

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry, openBrochure: jest.fn(), close: jest.fn() }),
}));

/** Test-only harness: MobileMenu renders null until the shared context says open. */
function OpenerButton() {
  const { toggle } = useMobileMenu();
  return (
    <button type="button" onClick={toggle}>
      toggle-for-test
    </button>
  );
}

const PHONE_TEL = '+919099957658';

function renderOpenMenu(pageLabel = 'Home') {
  render(
    <MobileMenuProvider>
      <OpenerButton />
      <MobileMenu pageLabel={pageLabel} phoneTel={PHONE_TEL} />
    </MobileMenuProvider>
  );
}

describe('MobileMenu', () => {
  beforeEach(() => {
    openEnquiry.mockClear();
  });

  it('renders nothing while closed', () => {
    render(
      <MobileMenuProvider>
        <MobileMenu pageLabel="Home" phoneTel={PHONE_TEL} />
      </MobileMenuProvider>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders exactly 5 nav items plus the Enquire CTA when open', async () => {
    const user = userEvent.setup();
    renderOpenMenu();
    await user.click(screen.getByText('toggle-for-test'));

    const expectedItems = ['Home', 'Tour Packages', 'Group Tours', 'Customized Tours', 'About Us'];
    for (const label of expectedItems) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    // Exactly 5 nav links — no extra/missing item.
    const navLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/'));
    expect(navLinks).toHaveLength(5);

    expect(screen.getByRole('button', { name: 'Enquire Now' })).toBeInTheDocument();
  });

  it('closes the menu when a nav item is clicked', async () => {
    const user = userEvent.setup();
    renderOpenMenu();
    await user.click(screen.getByText('toggle-for-test'));

    const homeLink = screen.getByRole('link', { name: /^Home/ });
    expect(homeLink).toBeInTheDocument();

    await user.click(homeLink);

    // AnimatePresence may keep the panel mounted for a moment after the
    // click (mid exit transition) before removing it — the actual contract
    // is "it leaves the DOM once the exit animation finishes", not
    // "instantly" or "synchronously", so only wait if it is not already gone.
    if (screen.queryByRole('link', { name: /^Home/ })) {
      await waitForElementToBeRemoved(() => screen.queryByRole('link', { name: /^Home/ }));
    }
  });

  it('closes the menu and calls openEnquiry with the page context when "Enquire Now" is clicked', async () => {
    const user = userEvent.setup();
    renderOpenMenu('Tour Packages');
    await user.click(screen.getByText('toggle-for-test'));

    await user.click(screen.getByRole('button', { name: 'Enquire Now' }));

    expect(openEnquiry).toHaveBeenCalledWith({ label: 'Page', value: 'Tour Packages' });
    if (screen.queryByRole('button', { name: 'Enquire Now' })) {
      await waitForElementToBeRemoved(() => screen.queryByRole('button', { name: 'Enquire Now' }));
    }
  });
});
