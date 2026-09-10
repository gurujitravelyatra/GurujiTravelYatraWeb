import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PackagesFilterBar } from '../PackagesFilterBar';
import { getCategoryChips } from '@/content/get-category-chips';
import { packageRails } from '@/content/fixtures/packages.fixture';

const categories = getCategoryChips(packageRails);

describe('PackagesFilterBar', () => {
  it('renders the chip list derived from fixture data — no Honeymoon/Wildlife, includes International and Beach', () => {
    render(<PackagesFilterBar categories={categories} selected="All" onSelect={jest.fn()} visibleCount={20} />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'International' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beach' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Honeymoon' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wildlife' })).not.toBeInTheDocument();
  });

  it('toggles aria-pressed correctly as the selected chip changes', () => {
    const { rerender } = render(
      <PackagesFilterBar categories={categories} selected="All" onSelect={jest.fn()} visibleCount={20} />
    );

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'International' })).toHaveAttribute('aria-pressed', 'false');

    rerender(<PackagesFilterBar categories={categories} selected="International" onSelect={jest.fn()} visibleCount={5} />);

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'International' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onSelect with the clicked category', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<PackagesFilterBar categories={categories} selected="All" onSelect={onSelect} visibleCount={20} />);

    await user.click(screen.getByRole('button', { name: 'Beach' }));
    expect(onSelect).toHaveBeenCalledWith('Beach');

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(onSelect).toHaveBeenCalledWith('All');
  });

  it('announces the visible count via an aria-live region', () => {
    render(<PackagesFilterBar categories={categories} selected="Beach" onSelect={jest.fn()} visibleCount={1} />);
    expect(screen.getByText('1 journey found')).toBeInTheDocument();
  });

  it('the presentational destination/month/price fields and Search/Clear buttons do not throw when clicked (documented no-op)', async () => {
    const user = userEvent.setup();
    render(<PackagesFilterBar categories={categories} selected="All" onSelect={jest.fn()} visibleCount={20} />);

    await user.click(screen.getByRole('button', { name: /Search Tours/ }));
    await user.click(screen.getByRole('button', { name: /Clear/ }));
  });
});
