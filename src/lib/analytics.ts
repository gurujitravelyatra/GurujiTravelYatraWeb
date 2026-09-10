/**
 * Minimal analytics event emitter.
 *
 * Per the Hard Architecture Boundary (tech spec §1) and CLAUDE.md §7, this
 * frontend only *emits* events — it never reads back score/activity-timeline
 * data (that's CRM-side). No analytics backend is wired yet (that's
 * CLAUDE.md §8 Sprint 6 scope), so this only logs in development, purely so
 * call sites (`call_click`, `whatsapp_click`, etc.) are exercisable and
 * greppable ahead of that sprint. Swapping in a real analytics SDK later is
 * a one-file change.
 */
export function trackEvent(name: string, detail?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[analytics] ${name}`, detail ?? {});
  }
}
