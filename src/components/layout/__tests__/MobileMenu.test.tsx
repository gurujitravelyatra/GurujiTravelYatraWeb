import { render, screen } from '@testing-library/react';
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

function renderOpenMenu(pageLabel = 'Home') {
  render(
    <MobileMenuProvider>
      <OpenerButton />
      <MobileMenu pageLabel={pageLabel} />
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
        <MobileMenu pageLabel="Home" />
      </MobileMenuProvider>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders exactly 5 nav items plus the Call/Enquire row when open', async () => {
    const user = userEvent.setup();
    renderOpenMenu();
    await user.click(screen.getByText('toggle-for-test'));

    const expectedItems = ['Home', 'Tour Packages', 'Group Tours', 'Customized Tours', 'About Us'];
    for (const label of expectedItems) {
      expect(screen.getByRole('link', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    // Exactly 5 nav links — no extra/missing item. Scoped to in-app routes so
    // the `tel:` "Call GTY" action link (asserted separately below) isn't
    // counted as a sixth nav item.
    const navLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/'));
    expect(navLinks).toHaveLength(5);

    expect(screen.getByRole('link', { name: /Call GTY/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enquire Now' })).toBeInTheDocument();
  });

  it('closes the menu when a nav item is clicked', async () => {
    const user = userEvent.setup();
    renderOpenMenu();
    await user.click(screen.getByText('toggle-for-test'));

    expect(screen.getByRole('link', { name: /^Home/ })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /^Home/ }));

    expect(screen.queryByRole('link', { name: /^Home/ })).not.toBeInTheDocument();
  });

  it('closes the menu and calls openEnquiry with the page context when "Enquire Now" is clicked', async () => {
    const user = userEvent.setup();
    renderOpenMenu('Tour Packages');
    await user.click(screen.getByText('toggle-for-test'));

    await user.click(screen.getByRole('button', { name: 'Enquire Now' }));

    expect(openEnquiry).toHaveBeenCalledWith({ label: 'Page', value: 'Tour Packages' });
    expect(screen.queryByRole('button', { name: 'Enquire Now' })).not.toBeInTheDocument();
  });
});
