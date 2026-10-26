'use client';

import * as React from 'react';

/**
 * CRM-migration Step 3 — renders Cloudflare's Turnstile challenge and
 * reports the resulting response token via `onVerify`, which `LeadModal`
 * writes into the (otherwise invisible) `turnstileToken` form field with
 * `form.setValue()`. `POST /public/enquiries` requires this token on every
 * request (documentation/technical-specification/public-website.md's
 * `POST /public/enquiries` §) — nothing here VERIFIES it; that happens on
 * the CRM, against Cloudflare, using a secret this site never holds
 * (`TURNSTILE_SECRET_KEY` is a CRM-only env var — see that same section).
 *
 * `siteKey` is the PUBLIC half of the pair and is meant to be visible in
 * the page source (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` — see `.env.example`):
 * Cloudflare's own docs describe the sitekey as safe to embed client-side,
 * the same trust model as a Google reCAPTCHA sitekey.
 *
 * ## Why this is not simply an `<iframe>`
 *
 * Turnstile is a script-rendered widget: `challenges.cloudflare.com/
 * turnstile/v0/api.js` exposes a `window.turnstile.render()` call that
 * mounts the challenge into a container element and calls back with a
 * token (or an expiry event) once solved. The script tag is appended once
 * per page (a `data-turnstile-script` marker on `document.head` makes a
 * second mount idempotent — e.g. both `EnquiryModal` and `BrochureModal`
 * existing on the same page tree) and reused by every widget instance.
 *
 * ## Test/SSR safety
 *
 * This never runs on the server (`'use client'`, and the mount logic is
 * entirely inside `useEffect`). In Jest (jsdom, no real Cloudflare script
 * will ever load) this component is REPLACED outright via
 * `jest.mock('@/components/modals/TurnstileWidget', ...)` in every test
 * that mounts `LeadModal` — this file makes no attempt to fake a passing
 * challenge itself, so there is no risk of a test accidentally depending on
 * real Cloudflare behaviour.
 */

export interface TurnstileWidgetProps {
  /** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. `LeadModal` does not render this component at all when unset — see its own comment. */
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

/** Loads the Turnstile script at most once per page, however many widgets mount. */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function TurnstileWidget({ siteKey, onVerify, onExpire }: TurnstileWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);

  // `onVerify`/`onExpire` are read via refs so the effect below only re-runs
  // if `siteKey` itself changes (it never does in practice) — not on every
  // render of the parent form, which would otherwise re-mount the widget
  // each time the visitor types a character. Updated in their OWN effect,
  // never during render — a ref write belongs in an effect or event
  // handler, not render itself.
  const onVerifyRef = React.useRef(onVerify);
  const onExpireRef = React.useRef(onExpire);
  React.useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
  }, [onVerify, onExpire]);

  React.useEffect(() => {
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => onVerifyRef.current(token),
          'expired-callback': () => onExpireRef.current(),
        });
      })
      .catch((error: unknown) => {
        // Network-blocked environments (an ad blocker, a locked-down
        // corporate network) should not crash the modal — the visitor
        // simply cannot pass verification, which the "Please complete the
        // verification challenge." field message already communicates
        // once they try to submit.
        console.error('[TurnstileWidget] could not load Cloudflare Turnstile:', error);
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} data-testid="turnstile-widget" />;
}
