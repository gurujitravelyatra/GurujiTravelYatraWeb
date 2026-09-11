'use client';

import { StepHeader } from './StepHeader';
import { SPECIAL_REQUESTS_MAX_LENGTH } from './trip-constants';

export interface AdditionalPreferencesStepProps {
  notes: string;
  onChangeNotes: (notes: string) => void;
}

const INERT_CHIPS: ReadonlyArray<{ label: string; path: React.ReactNode }> = [
  { label: 'Hotel Type', path: <path d="M4 3h9v18H4V3zm11 6h5v12h-5V9zM6 6v2h2V6H6zm3 0v2h2V6H9zm-3 4v2h2v-2H6zm3 0v2h2v-2H9zm-3 4v2h2v-2H6zm3 0v2h2v-2H9z" /> },
  {
    label: 'Food Preference',
    path: <path d="M8 3v7a3 3 0 0 0 2 2.8V21h2V12.8A3 3 0 0 0 14 10V3h-1.4v6h-1.2V3H10v6H8.8V3H8zm8 0c-1.4 1.3-2 3.4-2 5.6 0 1.9.7 3.2 2 3.7V21h1.6V3H16z" />,
  },
  {
    label: 'Vehicle Type',
    path: <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8h-2v3h-2v-3H6v3H4v-3H2V6h2zm2 1v4h12V7H6zm0 6.5a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm12 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />,
  },
  { label: 'Special Requests', path: <path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z" /> },
];

/**
 * Export lines 650-662 ("Additional Preferences (Optional)"). The four chips
 * are `onClick="{{ noop }}"` in the export — rendered here as disabled native
 * buttons (accessible name states "coming soon") rather than invented hotel
 * type / cuisine / vehicle option lists. The textarea is real: controlled,
 * capped at 500 chars with a live counter, using the export's own placeholder
 * copy verbatim (line 659).
 */
export function AdditionalPreferencesStep({ notes, onChangeNotes }: AdditionalPreferencesStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        step={4}
        title="Additional Preferences (Optional)"
        subtitle="Tell us more to make your trip truly yours."
      />

      <div role="group" aria-label="Additional preferences (coming soon)" className="flex flex-wrap gap-[11px]">
        {INERT_CHIPS.map(({ label, path }) => (
          <button
            key={label}
            type="button"
            disabled
            aria-label={`${label} — coming soon`}
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-pill border border-gty-border-3 px-[14px] py-[9px] text-13 font-semibold text-gty-ink-soft opacity-55"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true" className="flex-none text-gty-primary">
              {path}
            </svg>
            {label}
          </button>
        ))}
      </div>
      <p className="text-11 font-bold uppercase tracking-label text-gty-subtle">Coming soon</p>

      <div className="relative rounded-12 border border-gty-border-2 bg-gty-surface-2">
        <label htmlFor="ct-special-requests" className="sr-only">
          Any special requests?
        </label>
        <textarea
          id="ct-special-requests"
          value={notes}
          maxLength={SPECIAL_REQUESTS_MAX_LENGTH}
          onChange={(event) => onChangeNotes(event.target.value)}
          placeholder="Any special requests? (e.g. senior citizen, wheelchair, photoshoot, special darshan, etc.)"
          rows={3}
          className="w-full resize-none rounded-12 bg-transparent px-[18px] pb-[26px] pt-4 text-13-5 text-gty-ink outline-none placeholder:text-gty-placeholder"
        />
        <span aria-hidden="true" className="absolute bottom-2 right-[14px] text-11-5 text-gty-faint">
          {notes.length}/{SPECIAL_REQUESTS_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}
