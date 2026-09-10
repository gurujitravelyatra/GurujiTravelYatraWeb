'use client';

import * as React from 'react';

interface MobileMenuContextApi {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const MobileMenuContext = React.createContext<MobileMenuContextApi | null>(null);

/**
 * Scoped to `<Navbar>` only. Lets the burger button (in `HeaderControls`,
 * inside the sticky pill bar) and the slide-down panel (`MobileMenu`, a
 * sibling of the pill bar in the DOM) share open/close state without lifting
 * it into a server component or duplicating it.
 */
export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const value = React.useMemo<MobileMenuContextApi>(
    () => ({
      open,
      toggle: () => setOpen((current) => !current),
      close: () => setOpen(false),
    }),
    [open]
  );

  return <MobileMenuContext.Provider value={value}>{children}</MobileMenuContext.Provider>;
}

export function useMobileMenu(): MobileMenuContextApi {
  const ctx = React.useContext(MobileMenuContext);
  if (!ctx) {
    throw new Error('useMobileMenu must be used within a <MobileMenuProvider>');
  }
  return ctx;
}
