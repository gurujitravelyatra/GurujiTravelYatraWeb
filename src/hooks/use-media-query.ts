'use client';

import { useCallback, useSyncExternalStore } from 'react';

function subscribe(query: string, callback: () => void): () => void {
  const mediaQueryList = window.matchMedia(query);
  mediaQueryList.addEventListener('change', callback);
  return () => mediaQueryList.removeEventListener('change', callback);
}

/**
 * `window.matchMedia`-backed hook — tech spec §4.2. Reach for this ONLY when
 * *behavior*, not just visibility, must differ (e.g. rail scroll-by-N-px
 * amount). Pure visibility toggling should use Tailwind `{screen}:` /
 * `max-{screen}:` variants instead — see globals.css breakpoints.
 *
 * Built on `useSyncExternalStore` (the React-recommended way to subscribe to
 * an external mutable source like `matchMedia`) rather than
 * `useState`+`useEffect`, so there is no synchronous `setState` inside an
 * effect and no SSR/hydration mismatch — the server snapshot is always
 * `false`, matching the mismatch-safe default used elsewhere in this file
 * set.
 */
export function useMediaQuery(query: string): boolean {
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);
  const subscribeToQuery = useCallback((callback: () => void) => subscribe(query, callback), [query]);

  return useSyncExternalStore(subscribeToQuery, getSnapshot, getServerSnapshot);
}
