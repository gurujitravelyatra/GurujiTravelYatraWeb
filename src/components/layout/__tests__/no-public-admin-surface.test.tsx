import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { MobileMenu } from '../MobileMenu';
import { MobileActionBar } from '../MobileActionBar';
import { BottomContactStrip } from '../BottomContactStrip';
import { MobileMenuProvider, useMobileMenu } from '../mobile-menu-context';

/**
 * The admin area must remain UNADVERTISED on the public site.
 *
 * ## Why this test exists now, when it did not before
 *
 * Until 2026-09-17 this repo had a hard "zero admin surface" rule and several
 * tests asserting `/admin` did not exist at all. That rule was permanently
 * reversed by the user (`memory/project_gty_admin_reversal.md`), so "no admin
 * route" is no longer the invariant — but "no PUBLIC LINK to the admin route"
 * very much is, and it is a weaker claim that is much easier to break by
 * accident.
 *
 * The realistic regression is not malice, it is convenience: someone building the
 * Phase B tour CRUD gets tired of typing the URL and drops a "Manage tours" link
 * into the footer "just while developing". That link then ships, and every
 * visitor and every crawler finds the staff login.
 *
 * `robots.ts` keeps `/admin` out of search results, but a `Disallow` is a request,
 * not a control. A link in the public nav is a genuine disclosure regardless.
 *
 * ## Relationship to the older per-component tests
 *
 * `Footer.test.tsx`, `BottomContactStrip.test.tsx` and the legal-page tests each
 * carry a similar assertion for their own component. Those stay — they fail
 * closer to the cause. This file is the one that covers every public navigation
 * surface TOGETHER, so a new nav component cannot be added without either being
 * listed here or being obviously absent from a file named for this rule.
 */

const openEnquiry = jest.fn();

jest.mock('@/components/modals/modal-context', () => ({
  useModal: () => ({ modal: null, openEnquiry, openBrochure: jest.fn(), close: jest.fn() }),
}));

/**
 * Matches anything that would take a visitor to the staff area, or tell them it
 * exists. Broad on purpose — `/administrator`, `/cms`, `/dashboard` and a
 * WordPress-style `/wp-login` are all things a well-meaning person might add.
 */
const ADMIN_LINK_PATTERN = /admin|login|sign-?in|log-?in|dashboard|\/cms|wp-/i;

/** Visible text that would advertise the staff area even without a link. */
const ADMIN_TEXT_PATTERN = /\b(admin|log ?in|sign ?in|dashboard|staff sign-?in)\b/i;

function assertNoAdminSurface(container: HTMLElement): void {
  for (const link of Array.from(container.querySelectorAll('a'))) {
    expect(link.getAttribute('href') ?? '').not.toMatch(ADMIN_LINK_PATTERN);
  }

  // Forms too: a POST to the login endpoint is as much of a disclosure as a link.
  for (const form of Array.from(container.querySelectorAll('form'))) {
    expect(form.getAttribute('action') ?? '').not.toMatch(ADMIN_LINK_PATTERN);
  }

  expect(container.textContent ?? '').not.toMatch(ADMIN_TEXT_PATTERN);
}

function OpenerButton() {
  const { toggle } = useMobileMenu();
  return (
    <button type="button" onClick={toggle}>
      toggle-for-test
    </button>
  );
}

describe('no public navigation surface links to /admin', () => {
  it('Navbar', () => {
    const { container } = render(<Navbar activePath="/" pageLabel="Home" />);
    assertNoAdminSurface(container);
  });

  it('Footer', () => {
    const { container } = render(<Footer />);
    assertNoAdminSurface(container);
  });

  it('MobileActionBar', () => {
    const { container } = render(<MobileActionBar pageLabel="Home" />);
    assertNoAdminSurface(container);
  });

  it('BottomContactStrip', () => {
    const { container } = render(<BottomContactStrip />);
    assertNoAdminSurface(container);
  });

  it('MobileMenu, once opened', async () => {
    // MobileMenu renders null until the shared context says open, so the closed
    // state would trivially pass. Open it first, or this test asserts nothing.
    const { container } = render(
      <MobileMenuProvider>
        <OpenerButton />
        <MobileMenu pageLabel="Home" />
      </MobileMenuProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'toggle-for-test' }));

    // Guard against the test silently passing on an unopened menu.
    expect(container.querySelectorAll('a').length).toBeGreaterThan(0);
    assertNoAdminSurface(container);
  });
});

describe('the guard itself is not vacuous', () => {
  it('catches an admin link if one is ever added', () => {
    // A test that can only pass is not a test. This proves the matcher would fire
    // on the exact regression it is written to prevent.
    const { container } = render(
      <div>
        <a href="/admin">Manage tours</a>
      </div>
    );

    expect(() => assertNoAdminSurface(container)).toThrow();
  });
});
