'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { loginAction, type LoginFormState } from './actions';

const INITIAL_STATE: LoginFormState = { error: null };

interface LoginFormProps {
  /**
   * Already sanitised by the page via `safeReturnPath()`. Round-tripped through a
   * hidden field and sanitised AGAIN server-side in `loginAction`, because
   * anything that passes through the DOM is user-controlled by the time it comes
   * back.
   */
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  /**
   * There is no success branch to handle here. `loginAction` redirects from the
   * server on success, so the only thing that ever comes back as state is an
   * error message — which is why this component has no effect, no router and no
   * navigation logic of its own. (An earlier version did all three, and the
   * `next=` deep-link case silently never navigated. See `actions.ts`.)
   */
  const [state, formAction, pending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-email">Email</Label>
        <Input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          // The browser's own field-level validation is a convenience, not the
          // gate — `authorize()` re-validates with zod regardless.
          placeholder="you@gurujitravelyatra.com"
          aria-describedby={state.error ? 'admin-login-error' : undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-password">Password</Label>
        <Input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.error ? 'admin-login-error' : undefined}
        />
      </div>

      {state.error ? (
        /**
         * `role="alert"` so the failure is announced rather than silently
         * appearing — a sighted user sees the form "do nothing" otherwise, and a
         * screen-reader user gets no signal at all.
         */
        <p
          id="admin-login-error"
          role="alert"
          className="rounded-12 border border-gty-primary bg-gty-red-50 px-4 py-3 text-13-5 text-gty-primary"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={pending} className="mt-1 w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
