import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AboutCta } from '../AboutCta';

const openEnquiry = jest.fn();
jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry, openBrochure: jest.fn(), close: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AboutCta', () => {
  it('clicking "Start Your Journey" calls openEnquiry with { label: "Page", value: "About Us" }', async () => {
    const user = userEvent.setup();
    render(<AboutCta />);

    await user.click(screen.getByRole('button', { name: /Start Your Journey/ }));

    expect(openEnquiry).toHaveBeenCalledTimes(1);
    expect(openEnquiry).toHaveBeenCalledWith({ label: 'Page', value: 'About Us' });
  });
});
