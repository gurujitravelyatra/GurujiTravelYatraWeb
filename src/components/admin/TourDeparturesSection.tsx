'use client';

import { useFieldArray, useWatch, type Control, type UseFormRegister } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDepartureDateRange, isOrderedRange, parseIsoDate } from '@/lib/departure-dates';
import { formatSeatsLabel, parseSeatsInput } from '@/lib/seats';
import type { TourFormValues } from '@/server/admin/tours/tour-form-schema';

import { FormField } from './FormField';

/**
 * Whether this tour's batches are listed on `/group-tours` RIGHT NOW — resolved
 * on the server by `departureWithholdReason()`, the public gate itself, and
 * passed down rather than re-derived in the browser (the H1 lesson: a surface
 * that reports visibility must read the gate, not a copy of it).
 *
 *  - `LISTED`   — the tour is published and live, so its batches are listed.
 *  - `DRAFT`    — the tour is a draft, so its batches are hidden.
 *  - `ARCHIVED` — the tour is archived, so its batches are hidden.
 *  - `NEW`      — the tour has not been saved yet.
 */
export type DepartureVisibility = 'LISTED' | 'DRAFT' | 'ARCHIVED' | 'NEW';

const VISIBILITY_TEXT: Record<DepartureVisibility, string> = {
  LISTED: 'This tour is published, so the batches below are listed on /group-tours.',
  DRAFT:
    'This tour is a draft, so the batches below are NOT on /group-tours. They appear when the tour is published.',
  ARCHIVED:
    'This tour is archived, so the batches below are NOT on /group-tours — a departure of a withdrawn tour is never listed. Restore the tour to list them again.',
  NEW: 'Batches are listed on /group-tours once this tour is saved and published.',
};

interface TourDeparturesSectionProps {
  control: Control<TourFormValues>;
  register: UseFormRegister<TourFormValues>;
  fieldError: (path: string) => string | undefined;
  visibility: DepartureVisibility;
  /**
   * The safety flags of each STORED batch, keyed by batch slug — effective values,
   * as the public card shows them. Read-only: the admin cannot clear them (the
   * same user decision that keeps `pricingUnverified` off the form).
   */
  markers: Record<string, { durationUnverified: boolean; priceUnverified: boolean }>;
  /**
   * The TOUR's `pricingUnverified`. `toPublicDeparture()` marks every batch of
   * such a tour at read time — including one added in this form and not yet
   * saved, which has no entry in `markers` — so the price pill must follow it.
   */
  tourPricingUnverified: boolean;
}

/**
 * "Batch departures" — the tour's dated, seated `GroupDeparture` rows, edited in
 * the tour form and saved in the SAME transaction as the rest of the tour (after
 * the M7 version check). Added 2026-09-25.
 *
 * ## When it is shown
 *
 * When the tour is tagged `Group Tour`, OR when it already has batches. The
 * second half matters: the seeded tours carry no audience tags yet, and hiding a
 * tour's existing batches because nobody ticked a box would leave them public
 * and uneditable — the worst of both. The inverse idiom of `bestTimeToVisit`
 * (hidden FOR group tours), keyed on the same tag.
 *
 * ## Dates and seats are facts, not labels
 *
 * Two `<input type="date">` and a whole-number count. The public text ("12 — 18
 * May 2026", "14 seats left" / "Sold out") is written by the server from them,
 * and previewed here from the same formatters so the admin sees exactly what the
 * card will say before saving.
 */
export function TourDeparturesSection({
  control,
  register,
  fieldError,
  visibility,
  markers,
  tourPricingUnverified,
}: TourDeparturesSectionProps) {
  const batches = useFieldArray({ control, name: 'departures' });
  const audienceTags = useWatch({ control, name: 'audienceTags' }) ?? [];
  const tourName = useWatch({ control, name: 'name' }) ?? '';
  const values = useWatch({ control, name: 'departures' }) ?? [];

  const isGroupTour = audienceTags.includes('Group Tour');
  if (!isGroupTour && batches.fields.length === 0) return null;

  return (
    <section
      aria-labelledby="tour-departures-heading"
      data-testid="tour-departures-section"
      className="flex flex-col gap-5 rounded-18 border border-gty-border bg-gty-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="tour-departures-heading" className="text-16 font-extrabold text-gty-ink">
          Batch departures
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            batches.append({
              name: tourName.trim(),
              startDate: '',
              endDate: '',
              seatsAvailable: '',
              priceFrom: '',
              durationLabel: '',
              boardingPoints: '',
              tourManagerLabel: '',
            })
          }
        >
          + Add batch
        </Button>
      </div>

      <p
        role="status"
        data-testid="tour-departures-visibility"
        className="rounded-12 border border-gty-border-9 bg-gty-bg px-4 py-3 text-12-5 leading-relaxed text-gty-body"
      >
        {VISIBILITY_TEXT[visibility]}
        {!isGroupTour && (
          <>
            {' '}
            <strong className="font-bold text-gty-ink">
              This tour is not tagged “Group Tour”, but it has batches — they are still listed.
            </strong>{' '}
            Remove them here to take them off the site.
          </>
        )}
      </p>

      {batches.fields.length === 0 ? (
        <p className="text-12-5 text-gty-subtle">No batches yet. Add one for each fixed departure date.</p>
      ) : (
        batches.fields.map((field, index) => {
          const batch = values[index];
          const stored = batch?.slug ? markers[batch.slug] : undefined;
          const priceMarked = tourPricingUnverified || stored?.priceUnverified === true;
          const durationMarked = stored?.durationUnverified === true;
          const preview = previewLine(batch);
          const n = index + 1;
          return (
            <div
              key={field.id}
              data-testid={`departure-batch-${index}`}
              className="flex flex-col gap-4 rounded-12 border border-gty-border-4 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-12 font-bold uppercase tracking-label text-gty-subtle">Batch {n}</span>
                <Button type="button" size="sm" onClick={() => batches.remove(index)}>
                  Remove<span className="sr-only"> batch {n}</span>
                </Button>
              </div>

              {/*
                The SAME admin vocabulary the tour list uses for a withheld price —
                a bordered pill stating what the public site does with the figure —
                rather than a new visual language for "unconfirmed".
              */}
              {(priceMarked || durationMarked) && (
                <p className="flex flex-wrap gap-2" data-testid={`departure-batch-${index}-markers`}>
                  {priceMarked && (
                    <span className="inline-flex items-center rounded-pill border border-gty-border-9 bg-gty-bg px-[10px] py-[4px] text-11 font-bold text-gty-primary">
                      Price pending confirmation — marked with * on /group-tours
                    </span>
                  )}
                  {durationMarked && (
                    <span className="inline-flex items-center rounded-pill border border-gty-border-9 bg-gty-bg px-[10px] py-[4px] text-11 font-bold text-gty-primary">
                      Duration pending confirmation — marked with * on /group-tours
                    </span>
                  )}
                </p>
              )}

              <FormField
                id={`departure-${index}-name`}
                label="Batch title"
                hint="The heading on the /group-tours card. Usually the tour name."
                error={fieldError(`departures.${index}.name`)}
              >
                <Input {...register(`departures.${index}.name`)} />
              </FormField>

              <div className="grid grid-cols-1 gap-4 640:grid-cols-2">
                <FormField id={`departure-${index}-start`} label="Departs" error={fieldError(`departures.${index}.startDate`)}>
                  <Input type="date" {...register(`departures.${index}.startDate`)} />
                </FormField>
                <FormField id={`departure-${index}-end`} label="Returns" error={fieldError(`departures.${index}.endDate`)}>
                  <Input type="date" {...register(`departures.${index}.endDate`)} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 640:grid-cols-2">
                <FormField
                  id={`departure-${index}-seats`}
                  label="Seats available"
                  hint="0 marks the batch sold out and removes its Reserve button."
                  error={fieldError(`departures.${index}.seatsAvailable`)}
                >
                  <Input type="number" inputMode="numeric" min={0} max={999} step={1} {...register(`departures.${index}.seatsAvailable`)} />
                </FormField>
                <FormField
                  id={`departure-${index}-price`}
                  label="Price"
                  hint="Per person, written exactly as it should appear, e.g. “₹42,500”."
                  error={fieldError(`departures.${index}.priceFrom`)}
                >
                  <Input {...register(`departures.${index}.priceFrom`)} placeholder="₹42,500" />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 640:grid-cols-3">
                <FormField id={`departure-${index}-duration`} label="Duration" error={fieldError(`departures.${index}.durationLabel`)}>
                  <Input {...register(`departures.${index}.durationLabel`)} placeholder="6N / 7D" />
                </FormField>
                <FormField
                  id={`departure-${index}-boarding`}
                  label="Boarding points"
                  error={fieldError(`departures.${index}.boardingPoints`)}
                >
                  <Input {...register(`departures.${index}.boardingPoints`)} placeholder="Ahmedabad · Delhi" />
                </FormField>
                <FormField
                  id={`departure-${index}-manager`}
                  label="Tour manager"
                  error={fieldError(`departures.${index}.tourManagerLabel`)}
                >
                  <Input {...register(`departures.${index}.tourManagerLabel`)} placeholder="Yes, GTY manager" />
                </FormField>
              </div>

              <p className="text-12-5 text-gty-muted" aria-live="polite" data-testid={`departure-batch-${index}-preview`}>
                {preview ? (
                  <>
                    Visitors will see: <strong className="font-bold text-gty-ink">{preview}</strong>
                  </>
                ) : (
                  'Enter the dates and seats to preview how this batch will read.'
                )}
              </p>
            </div>
          );
        })
      )}
    </section>
  );
}

/** "12 — 18 May 2026 · 14 seats left", from the same formatters the server writes with. */
function previewLine(batch: { startDate?: string; endDate?: string; seatsAvailable?: string } | undefined) {
  if (!batch?.startDate || !batch.endDate) return undefined;
  if (!parseIsoDate(batch.startDate) || !parseIsoDate(batch.endDate)) return undefined;
  if (!isOrderedRange(batch.startDate, batch.endDate)) return undefined;
  const seats = parseSeatsInput(batch.seatsAvailable ?? '');
  if (seats === undefined) return undefined;
  return `${formatDepartureDateRange(batch.startDate, batch.endDate)} · ${formatSeatsLabel(seats)}`;
}
