'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Loader2, MapPin, Users } from 'lucide-react';

import { tripFinderTabs } from '@/lib/trip-finder-tabs';
import { cn } from '@/lib/utils';

/**
 * Export lines 177-188, tech spec §4.4 row 3. Overlaps the hero's bottom
 * edge via a negative top margin.
 *
 * "Redux" redesign (brief §5, 2026-11-14): sliding active-tab pill via
 * `layoutId` (framer-motion), restyled fields/CTA.
 *
 * Brief §B (2026-11-14), scoped per the user's "lean but real" decision:
 * all three fields are now REAL — Destination (free text, suggestions from
 * real CRM place names + states), Journey Month (Jan-Dec, default "Any
 * month"), Travellers (1/2/3-4/5+, default 2). "Explore Now" POSTs the
 * current tab + these three values to `/api/trip-finder` and navigates to
 * whatever URL the server resolves (see `resolveTripFinder` for the full
 * routing rules) — this component holds no routing logic of its own,
 * exactly as the brief asks ("do the routing on the server").
 */
export interface TripFinderBarProps {
  /** Real CRM place names + states (`CrmPlace.region`) for the destination `<datalist>` — never invented, never tour titles (would need a separate fetch; see `resolveTripFinder`'s own header). */
  destinationSuggestions: string[];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const TRAVELLER_OPTIONS = [
  { value: '1', label: '1 Traveller' },
  { value: '2', label: '2 Travellers' },
  { value: '3-4', label: '3-4 Travellers' },
  { value: '5+', label: '5+ / Group' },
] as const;

interface TripFinderApiResult {
  url: string;
  isFallbackToCustom: boolean;
  monthMismatchNote?: string;
}

export function TripFinderBar({ destinationSuggestions }: TripFinderBarProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [destination, setDestination] = useState('');
  const [month, setMonth] = useState('');
  const [travellers, setTravellers] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const datalistId = useId();
  const activeTab = tripFinderTabs[activeIndex];

  async function handleExploreNow() {
    // No-double-submit: a second click while the first request is still in
    // flight is a no-op, not a second navigation.
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/trip-finder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tab: activeTab.key, destination, month, travellers }),
      });
      const body = (await response.json()) as { data?: TripFinderApiResult; error?: string };

      if (!response.ok || !body.data) {
        setMessage("We couldn't check that just now — please try again in a moment.");
        setIsSubmitting(false);
        return;
      }

      const { url, isFallbackToCustom, monthMismatchNote } = body.data;
      if (isFallbackToCustom) {
        setMessage(
          destination.trim()
            ? `No ready-made tour for ${destination.trim()}, let's design one for you.`
            : "Let's design a trip for you."
        );
      } else if (monthMismatchNote) {
        setMessage(monthMismatchNote);
      }
      // `router.push` (never `replace`) — the back button must return here
      // with the form state intact, which an unmounted/remounted page
      // naturally does since nothing above is cleared on navigate.
      router.push(url);
    } catch {
      setMessage("We couldn't check that just now — please try again in a moment.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="relative z-20 bg-redux-cream px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        data-testid="section-3-trip-finder"
        className="mx-auto max-w-6xl rounded-[2rem] border border-stone-200/80 bg-white p-5 shadow-[0_40px_80px_-40px_rgba(127,18,22,0.3)] sm:p-7"
      >
        <div className="flex gap-1 overflow-x-auto border-b border-stone-100 pb-3 no-scrollbar sm:gap-2">
          {tripFinderTabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setMessage(null);
              }}
              aria-pressed={index === activeIndex}
              className={cn(
                'relative shrink-0 rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors duration-300 sm:px-5 sm:text-sm',
                index === activeIndex ? 'text-white' : 'text-redux-ink-soft hover:text-redux-crimson'
              )}
            >
              {index === activeIndex && (
                <motion.span
                  layoutId="finder-tab-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-redux-crimson shadow-[0_10px_22px_-8px_rgba(220,38,38,0.65)]"
                />
              )}
              <span className="relative">{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-stretch">
          <FinderField icon={<MapPin size={17} />}>
            <input
              type="text"
              list={datalistId}
              aria-label="Where do you want to go?"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Where do you want to go?"
              className="w-full min-w-0 bg-transparent text-[15px] font-medium text-stone-900 outline-none placeholder:text-stone-400"
            />
            <datalist id={datalistId}>
              {destinationSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </FinderField>

          <FinderField icon={<Calendar size={17} />}>
            <select
              aria-label="Journey month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full min-w-0 appearance-none bg-transparent text-[15px] font-medium text-stone-900 outline-none"
            >
              <option value="">Any month</option>
              {MONTHS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </FinderField>

          <FinderField icon={<Users size={17} />}>
            <select
              aria-label="Travellers"
              value={travellers}
              onChange={(event) => setTravellers(event.target.value)}
              className="w-full min-w-0 appearance-none bg-transparent text-[15px] font-medium text-stone-900 outline-none"
            >
              {TRAVELLER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FinderField>

          <button
            type="button"
            onClick={handleExploreNow}
            disabled={isSubmitting}
            data-testid="trip-finder-cta"
            className="btn-shine group flex items-center justify-center gap-2.5 rounded-2xl bg-redux-crimson px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_35px_-14px_rgba(220,38,38,0.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-redux-crimson-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                Searching…
              </>
            ) : (
              <>
                Explore Now
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
        <p aria-live="polite" className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-redux-ink-mute">
          {message ?? activeTab.hint}
        </p>
      </motion.div>
    </section>
  );
}

/**
 * A real, working field — replaces the old `DecorativeField`'s permanent
 * "SOON" chip now that every field is wired (brief §B). Each control sets
 * its own `aria-label` directly (not an `aria-label` on this wrapper) —
 * `getByLabelText` resolves a wrapping `<label>`'s accessible name from its
 * TEXT CONTENT, not its own `aria-label` attribute, and this wrapper's only
 * text would otherwise be whatever a `<select>`'s own `<option>`s contain.
 */
function FinderField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-redux-cream px-4 py-3.5 transition-colors duration-300 hover:border-redux-crimson/40 focus-within:border-redux-crimson/40">
      <span className="text-redux-crimson">{icon}</span>
      {children}
    </div>
  );
}
