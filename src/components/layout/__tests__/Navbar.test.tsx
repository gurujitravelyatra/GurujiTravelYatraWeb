import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Navbar } from '../Navbar';

const openEnquiry = jest.fn();

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry, openBrochure: jest.fn(), close: jest.fn() }),
}));

describe('Navbar', () => {
  beforeEach(() => {
    openEnquiry.mockClear();
  });

  it('renders the specified 4-item nav link list', () => {
    render(<Navbar activePath="/" pageLabel="Home" />);

    const nav = screen.getByRole('link', { name: 'Home' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tour Packages' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Group Tours' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Customized Tours' })).toBeInTheDocument();
  });

  it('marks the active page link current', () => {
    render(<Navbar activePath="/tour-packages" pageLabel="Tour Packages" />);

    expect(screen.getByRole('link', { name: 'Tour Packages' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('burger toggles the MobileMenu open and closed', async () => {
    const user = userEvent.setup();
    render(<Navbar activePath="/" pageLabel="Home" />);

    // MobileMenu renders null while closed — none of its 5 items exist yet.
    expect(screen.queryByRole('link', { name: 'About Us' })).not.toBeInTheDocument();

    const burger = screen.getByRole('button', { name: 'Open menu' });
    await user.click(burger);

    expect(await screen.findByRole('link', { name: 'About Us' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('link', { name: 'About Us' })).not.toBeInTheDocument();
  });

  it('CTA click calls openEnquiry with the current page context', async () => {
    const user = userEvent.setup();
    render(<Navbar activePath="/tour-packages" pageLabel="Tour Packages" />);

    await user.click(screen.getByRole('button', { name: /Enquire/ }));

    expect(openEnquiry).toHaveBeenCalledTimes(1);
    expect(openEnquiry).toHaveBeenCalledWith({ label: 'Page', value: 'Tour Packages' });
  });
});
