'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AUDIENCE_TAG_VALUES,
  CATEGORY_VALUES,
  slugify,
  tourFormSchema,
  type SubmitIntent,
  type TourFormValues,
} from '@/server/admin/tours/tour-form-schema';
import { saveTourAction } from '@/app/admin/tours/actions';
import { EMPTY_FORM_STATE, type TourFormState } from '@/app/admin/tours/form-state';

import { FormField } from './FormField';
import { TourUploadsSection } from './TourUploadsSection';

interface DestinationOption {
  slug: string;
  name: string;
}

interface TourFormProps {
  destinations: DestinationOption[];
  /** Absent when creating. Present when editing — also the slug the action updates. */
  editingSlug?: string;
  defaultValues: TourFormValues;
  /** True when the tour being edited is currently live — drives the slug warning. */
  isPublished?: boolean;
  /** Set when the list view's Publish toggle bounced the admin here. */
  publishBlocked?: boolean;
  /**
   * Whether this environment has a Cloudinary account configured. Resolved on the
   * SERVER (`isCloudinaryConfigured()` reads the API secret's siblings and is
   * `server-only`) and passed down as a boolean, so nothing about the credential
   * — not even its absence — is decided in the browser.
   */
  uploadsEnabled?: boolean;
}

const EMPTY_VALUES: TourFormValues = {
  name: '',
  slug: '',
  destinationSlug: '',
  category: 'Spiritual',
  audienceTags: [],
  durationLabel: '',
  subtitle: '',
  shortDescription: '',
  fullDescription: '',
  bestTimeToVisit: '',
  priceFrom: '',
  priceWas: '',
  savingsLabel: '',
  seatsLabel: '',
  isHot: false,
  inclusions: [],
  exclusions: [],
  itineraryDays: [],
  faqs: [],
  pricingTiers: [],
  coverImage: undefined,
  galleryImages: [],
  brochureFile: undefined,
};

/**
 * The tour editor — `/admin/tours/new` and `/admin/tours/[id]/edit`.
 *
 * ## One component for both routes
 *
 * Create and edit differ only in whether `editingSlug` is set. Two components
 * would be two copies of thirty fields, and the failure mode of that duplication
 * is a field added to one and not the other — which on this form means an edit
 * that silently blanks a column the create form still writes.
 *
 * ## Validation runs twice, on purpose
 *
 * React Hook Form validates with `tourFormSchema` for immediate feedback; the
 * server action re-parses the same payload with the schema the INTENT demands
 * (`parseTourForm`). The client's copy is a convenience and is not trusted —
 * this form posts to a server action, which is a public POST endpoint with a
 * stable ID, reachable without ever loading this page.
 *
 * Note the client always validates at the DRAFT level even when Publish is
 * pressed. That is deliberate: the publish requirements are enforced server-side
 * where they cannot be bypassed, and the returned field errors are routed back
 * into the same `FormField` slots via `setError`, so the admin sees them in
 * place rather than as a banner listing field names.
 */
export function TourForm({
  destinations,
  editingSlug,
  defaultValues,
  isPublished = false,
  publishBlocked = false,
  uploadsEnabled = false,
}: TourFormProps) {
  const [state, formAction, pending] = useActionState<TourFormState, FormData>(
    saveTourAction,
    EMPTY_FORM_STATE
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TourFormValues>({
    resolver: zodResolver(tourFormSchema),
    defaultValues: { ...EMPTY_VALUES, ...defaultValues },
    mode: 'onBlur',
  });

  const itinerary = useFieldArray({ control, name: 'itineraryDays' });
  const faqs = useFieldArray({ control, name: 'faqs' });
  const tiers = useFieldArray({ control, name: 'pricingTiers' });
  const inclusions = useFieldArray({ control, name: 'inclusions' as never });
  const exclusions = useFieldArray({ control, name: 'exclusions' as never });

  /**
   * The intent is carried in a hidden input rather than in component state,
   * because `useActionState` submits the form's own FormData — a `useState`
   * written in the click handler would race the submission it is meant to
   * describe.
   */
  const intentRef = useRef<HTMLInputElement>(null);
  const payloadRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Server-side field errors are routed into the SAME slots client-side
   * validation renders into, not a second error UI. A publish refusal
   * ("a short description is required to publish") then appears under the short
   * description field, which is the only place it is actionable.
   */
  useEffect(() => {
    for (const [path, message] of Object.entries(state.fieldErrors)) {
      setError(path as keyof TourFormValues, { type: 'server', message });
    }
  }, [state.fieldErrors, setError]);

  /**
   * Slug auto-generation, and why it stops.
   *
   * The slug tracks the title only until the admin edits the slug themselves —
   * after that it is theirs and the title no longer overwrites it. Continuing to
   * regenerate would silently discard a hand-chosen URL on the next title tweak.
   * Editing an EXISTING tour never auto-generates at all: that slug is a live
   * address, and rewriting it because someone fixed a typo in the title would
   * change the tour's public URL as a side effect of an unrelated edit.
   */
  /**
   * `useWatch` rather than the `watch()` returned by `useForm`. The two are
   * equivalent in behaviour here, but `watch()` is a fresh function identity on
   * every render, which React Compiler flags as unmemoizable (`Compilation
   * Skipped: Use of incompatible library`). `useWatch` subscribes through the
   * control object instead and compiles cleanly.
   */
  const [slugTouched, setSlugTouched] = useState(Boolean(editingSlug));
  const nameValue = useWatch({ control, name: 'name' });
  useEffect(() => {
    if (slugTouched) return;
    setValue('slug', slugify(nameValue ?? ''), { shouldValidate: false });
  }, [nameValue, slugTouched, setValue]);

  const audienceTags = useWatch({ control, name: 'audienceTags' }) ?? [];
  const isGroupTour = audienceTags.includes('Group Tour');

  /**
   * Single-price vs tiers is derived from whether any tier rows exist — there is
   * no boolean anywhere, in the form or the schema. See `TourPricingTier` in
   * `prisma/schema.prisma`: a flag beside the rows is a second source of truth
   * for one fact, and the two drift.
   */
  const tierRows = useWatch({ control, name: 'pricingTiers' }) ?? [];
  const usesTiers = tierRows.length > 0;

  const currentSlug = useWatch({ control, name: 'slug' });
  const slugChanged = Boolean(editingSlug) && currentSlug !== editingSlug;

  /**
   * Serialises the validated values into the hidden payload field and submits.
   * `handleSubmit` runs the resolver first, so a draft-invalid form never
   * reaches the server; a publish-invalid one does, and comes back with field
   * errors from the authoritative schema.
   */
  const submitWith = (intent: SubmitIntent) =>
    handleSubmit((values) => {
      if (intentRef.current) intentRef.current.value = intent;
      if (payloadRef.current) payloadRef.current.value = JSON.stringify(values);
      formRef.current?.requestSubmit();
    });

  const fieldError = (path: string): string | undefined => {
    const segments = path.split('.');
    let node: unknown = errors;
    for (const segment of segments) {
      if (node === null || typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[segment];
    }
    const message = (node as { message?: unknown } | undefined)?.message;
    return typeof message === 'string' ? message : undefined;
  };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="intent" ref={intentRef} defaultValue="draft" />
      <input type="hidden" name="payload" ref={payloadRef} defaultValue="" />
      {editingSlug && <input type="hidden" name="editingSlug" value={editingSlug} />}

      {publishBlocked && (
        <p
          role="alert"
          className="rounded-12 border border-gty-primary bg-gty-red-50 px-4 py-3 text-13-5 text-gty-primary"
        >
          This tour could not be published from the list because it is missing fields that a published tour
          needs. Press <strong>Publish</strong> below to see exactly which.
        </p>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-12 border border-gty-primary bg-gty-red-50 px-4 py-3 text-13-5 text-gty-primary"
        >
          {state.error}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-5 rounded-18 border border-gty-border bg-gty-white p-5">
        <h2 className="text-16 font-extrabold text-gty-ink">Basics</h2>

        <FormField id="tour-name" label="Tour name" error={fieldError('name')} requiredToPublish>
          <Input {...register('name')} placeholder="Spiti Valley Circuit" />
        </FormField>

        <FormField
          id="tour-slug"
          label="Slug"
          hint={
            editingSlug
              ? 'The tour’s public URL: /tour-packages/<slug>.'
              : 'Generated from the name until you edit it. The tour’s public URL: /tour-packages/<slug>.'
          }
          error={fieldError('slug')}
          requiredToPublish
        >
          <Input
            {...register('slug', { onChange: () => setSlugTouched(true) })}
            placeholder="spiti-valley-circuit"
          />
        </FormField>

        {/*
          Changing a live tour's slug changes its public URL and this project has
          no redirect table, so any existing inbound link breaks. That is a real
          cost, so it is stated at the moment the admin creates it rather than
          discovered later.
        */}
        {slugChanged && isPublished && (
          <p
            role="alert"
            className="rounded-12 border border-gty-border-9 bg-gty-bg px-4 py-3 text-12-5 leading-relaxed text-gty-body"
          >
            <strong className="font-bold text-gty-ink">This changes a live URL.</strong> This tour is
            published at <code>/tour-packages/{editingSlug}</code>. Saving will move it to{' '}
            <code>/tour-packages/{currentSlug}</code>, and the old address will stop working — there is no
            redirect. Anything already linking to it (campaigns, WhatsApp messages, search results) will
            404.
          </p>
        )}

        <FormField id="tour-destination" label="Destination" error={fieldError('destinationSlug')} requiredToPublish>
          <select
            {...register('destinationSlug')}
            className="min-h-[42px] rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 text-13-5 text-gty-ink"
          >
            <option value="">Choose a destination…</option>
            {destinations.map((destination) => (
              <option key={destination.slug} value={destination.slug}>
                {destination.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="tour-category"
          label="Category (theme)"
          hint="Drives the public filter chips on /tour-packages. This is the THEME — who the tour is sold to is the separate Audience field below."
          error={fieldError('category')}
          requiredToPublish
        >
          <select
            {...register('category')}
            className="min-h-[42px] rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 text-13-5 text-gty-ink"
          >
            {CATEGORY_VALUES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-10 font-bold uppercase tracking-label text-gty-subtle">
            Audience
          </legend>
          <p className="text-12 leading-relaxed text-gty-subtle">
            A separate axis from Category — a tour can be both “Spiritual” and “Domestic”. Not shown on the
            public site yet.
          </p>
          <div className="flex flex-wrap gap-4 pt-1">
            {AUDIENCE_TAG_VALUES.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-13-5 text-gty-ink">
                <input type="checkbox" value={tag} {...register('audienceTags')} className="h-4 w-4" />
                {tag}
              </label>
            ))}
          </div>
        </fieldset>

        <FormField
          id="tour-duration"
          label="Duration"
          error={fieldError('durationLabel')}
          requiredToPublish
        >
          <Input {...register('durationLabel')} placeholder="9 Days 8 Nights" />
        </FormField>

        <FormField
          id="tour-subtitle"
          label="Route line"
          hint="The short route shown under the title on cards, e.g. “Shimla - Kaza - Chandratal”. Not a description."
          error={fieldError('subtitle')}
        >
          <Input {...register('subtitle')} placeholder="Shimla - Kaza - Chandratal" />
        </FormField>

        {/*
          Per the product spec this applies to regular tours only — a fixed-
          departure group tour's answer is its departure date. Hidden rather than
          disabled when Group Tour is tagged: a disabled field implies "fill this
          in later", and this one is genuinely not applicable.
        */}
        {!isGroupTour && (
          <FormField
            id="tour-best-time"
            label="Best time to visit"
            hint="Regular tours only. Group tours answer this with their departure dates."
            error={fieldError('bestTimeToVisit')}
          >
            <Input {...register('bestTimeToVisit')} placeholder="March to June" />
          </FormField>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-5 rounded-18 border border-gty-border bg-gty-white p-5">
        <h2 className="text-16 font-extrabold text-gty-ink">Descriptions</h2>

        <FormField
          id="tour-short-description"
          label="Short description"
          hint="Shown on the tour card. The only prose a visitor sees before opening the tour."
          error={fieldError('shortDescription')}
          requiredToPublish
        >
          <Textarea {...register('shortDescription')} rows={3} />
        </FormField>

        <FormField
          id="tour-full-description"
          label="Full description"
          hint="Shown on the tour detail page."
          error={fieldError('fullDescription')}
        >
          <Textarea {...register('fullDescription')} rows={6} />
        </FormField>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-5 rounded-18 border border-gty-border bg-gty-white p-5">
        <h2 className="text-16 font-extrabold text-gty-ink">Pricing</h2>

        <p className="rounded-12 border border-gty-border-9 bg-gty-bg px-4 py-3 text-12-5 leading-relaxed text-gty-body">
          {usesTiers ? (
            <>
              <strong className="font-bold text-gty-ink">Using pricing tiers.</strong> The single price
              below is ignored while any tier exists. Remove every tier to go back to a single price.
            </>
          ) : (
            <>
              <strong className="font-bold text-gty-ink">Using a single price.</strong> Add a tier below to
              switch this tour to named tiers instead.
            </>
          )}
        </p>

        <fieldset disabled={usesTiers} className="flex flex-col gap-5 disabled:opacity-50">
          <FormField
            id="tour-price-from"
            label="Price"
            hint="Written exactly as it should appear, e.g. “₹42,500”."
            error={fieldError('priceFrom')}
            requiredToPublish
          >
            <Input {...register('priceFrom')} placeholder="₹42,500" />
          </FormField>

          <FormField
            id="tour-price-was"
            label="Was price (optional)"
            hint="Only fill this in if the tour genuinely was sold at this price. It renders a “was ₹X” strikethrough."
            error={fieldError('priceWas')}
          >
            <Input {...register('priceWas')} placeholder="₹47,700" />
          </FormField>

          <FormField
            id="tour-savings"
            label="Savings label (optional)"
            hint="Renders as “Save ₹…”. Leave empty unless the saving is real."
            error={fieldError('savingsLabel')}
          >
            <Input {...register('savingsLabel')} placeholder="5,200" />
          </FormField>
        </fieldset>

        <div className="flex flex-col gap-4 border-t border-gty-border-4 pt-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-14 font-extrabold text-gty-ink">Pricing tiers</h3>
            <Button
              type="button"
              size="sm"
              onClick={() => tiers.append({ name: '', price: '', description: '' })}
            >
              + Add tier
            </Button>
          </div>

          {tiers.fields.length === 0 ? (
            <p className="text-12-5 text-gty-subtle">
              No tiers — this tour uses the single price above.
            </p>
          ) : (
            tiers.fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-4 rounded-12 border border-gty-border-4 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-12 font-bold uppercase tracking-label text-gty-subtle">
                    Tier {index + 1}
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" size="sm" disabled={index === 0} onClick={() => tiers.move(index, index - 1)}>
                      ↑<span className="sr-only">Move tier {index + 1} up</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={index === tiers.fields.length - 1}
                      onClick={() => tiers.move(index, index + 1)}
                    >
                      ↓<span className="sr-only">Move tier {index + 1} down</span>
                    </Button>
                    <Button type="button" size="sm" onClick={() => tiers.remove(index)}>
                      Remove<span className="sr-only"> tier {index + 1}</span>
                    </Button>
                  </span>
                </div>

                <FormField
                  id={`tier-${index}-name`}
                  label="Tier name"
                  error={fieldError(`pricingTiers.${index}.name`)}
                >
                  <Input {...register(`pricingTiers.${index}.name`)} placeholder="Deluxe" />
                </FormField>

                <FormField
                  id={`tier-${index}-price`}
                  label="Tier price"
                  error={fieldError(`pricingTiers.${index}.price`)}
                >
                  <Input {...register(`pricingTiers.${index}.price`)} placeholder="₹52,500" />
                </FormField>

                <FormField
                  id={`tier-${index}-description`}
                  label="What this tier includes (optional)"
                  error={fieldError(`pricingTiers.${index}.description`)}
                >
                  <Textarea {...register(`pricingTiers.${index}.description`)} rows={2} />
                </FormField>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-5 rounded-18 border border-gty-border bg-gty-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-16 font-extrabold text-gty-ink">Itinerary</h2>
          <Button type="button" size="sm" onClick={() => itinerary.append({ title: '', description: '' })}>
            + Add day
          </Button>
        </div>

        {itinerary.fields.length === 0 ? (
          <p className="text-12-5 text-gty-subtle">No itinerary days yet.</p>
        ) : (
          itinerary.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-4 rounded-12 border border-gty-border-4 p-4">
              <div className="flex items-center justify-between">
                {/*
                  "Day N" is the array position. Day numbers are re-derived from
                  order on save (see `childCreates`), so removing a middle day
                  renumbers the rest rather than leaving a gap.
                */}
                <span className="text-12 font-bold uppercase tracking-label text-gty-subtle">
                  Day {index + 1}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => itinerary.move(index, index - 1)}
                  >
                    ↑<span className="sr-only">Move day {index + 1} up</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={index === itinerary.fields.length - 1}
                    onClick={() => itinerary.move(index, index + 1)}
                  >
                    ↓<span className="sr-only">Move day {index + 1} down</span>
                  </Button>
                  <Button type="button" size="sm" onClick={() => itinerary.remove(index)}>
                    Remove<span className="sr-only"> day {index + 1}</span>
                  </Button>
                </span>
              </div>

              <FormField
                id={`day-${index}-title`}
                label="Title"
                error={fieldError(`itineraryDays.${index}.title`)}
              >
                <Input {...register(`itineraryDays.${index}.title`)} placeholder="Arrive in Shimla" />
              </FormField>

              <FormField
                id={`day-${index}-description`}
                label="Description"
                error={fieldError(`itineraryDays.${index}.description`)}
              >
                <Textarea {...register(`itineraryDays.${index}.description`)} rows={3} />
              </FormField>
            </div>
          ))
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-6 rounded-18 border border-gty-border bg-gty-white p-5">
        <h2 className="text-16 font-extrabold text-gty-ink">Inclusions &amp; exclusions</h2>

        <StringListEditor
          legend="What’s included"
          name="inclusions"
          fields={inclusions.fields}
          onAppend={() => inclusions.append('' as never)}
          onRemove={(index) => inclusions.remove(index)}
          register={register}
        />

        <StringListEditor
          legend="What’s not included"
          name="exclusions"
          fields={exclusions.fields}
          onAppend={() => exclusions.append('' as never)}
          onRemove={(index) => exclusions.remove(index)}
          register={register}
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="flex flex-col gap-5 rounded-18 border border-gty-border bg-gty-white p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-16 font-extrabold text-gty-ink">FAQs</h2>
          <Button type="button" size="sm" onClick={() => faqs.append({ question: '', answer: '' })}>
            + Add FAQ
          </Button>
        </div>

        {faqs.fields.length === 0 ? (
          <p className="text-12-5 text-gty-subtle">No FAQs yet.</p>
        ) : (
          faqs.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-4 rounded-12 border border-gty-border-4 p-4">
              <div className="flex items-center justify-between">
                <span className="text-12 font-bold uppercase tracking-label text-gty-subtle">
                  FAQ {index + 1}
                </span>
                <span className="flex gap-2">
                  <Button type="button" size="sm" disabled={index === 0} onClick={() => faqs.move(index, index - 1)}>
                    ↑<span className="sr-only">Move FAQ {index + 1} up</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={index === faqs.fields.length - 1}
                    onClick={() => faqs.move(index, index + 1)}
                  >
                    ↓<span className="sr-only">Move FAQ {index + 1} down</span>
                  </Button>
                  <Button type="button" size="sm" onClick={() => faqs.remove(index)}>
                    Remove<span className="sr-only"> FAQ {index + 1}</span>
                  </Button>
                </span>
              </div>

              <FormField id={`faq-${index}-question`} label="Question" error={fieldError(`faqs.${index}.question`)}>
                <Input {...register(`faqs.${index}.question`)} />
              </FormField>

              <FormField id={`faq-${index}-answer`} label="Answer" error={fieldError(`faqs.${index}.answer`)}>
                <Textarea {...register(`faqs.${index}.answer`)} rows={3} />
              </FormField>
            </div>
          ))
        )}
      </section>

      {/*
        `control` and `setValue` rather than `register`: a file input's value
        cannot be controlled by React, so what is registered is the UPLOAD RESULT
        (a URL and a publicId), which the section writes with `setValue` once the
        file is safely in Cloudinary. Registering the input itself would bind the
        form to a `FileList` the server never receives.
      */}
      <TourUploadsSection
        control={control}
        setValue={setValue}
        editingSlug={editingSlug}
        uploadsEnabled={uploadsEnabled}
        coverError={fieldError('coverImage')}
      />

      {/* ---------------------------------------------------------------- */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-gty-border bg-gty-bg/95 py-4 backdrop-blur">
        {/*
          TWO submit actions, not one Save plus a status dropdown. The admin is
          choosing an action, and "Save as Draft" on a published tour is the
          un-publish path — which is why it is not labelled "Save".
        */}
        {/*
          `submitWith(...)` is BUILT and CALLED inside the handler, not during
          render. Passing `onClick={submitWith('draft')}` would construct the
          handler on every render and read the refs it closes over while
          rendering, which React Compiler correctly rejects.
        */}
        <Button type="button" disabled={pending} onClick={() => void submitWith('draft')()}>
          {pending ? 'Saving…' : 'Save as Draft'}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => void submitWith('publish')()}
        >
          {pending ? 'Saving…' : 'Publish'}
        </Button>

        <p className="text-12 text-gty-subtle">
          {isPublished
            ? 'This tour is live. “Save as Draft” will remove it from the public site.'
            : 'Drafts are never visible on the public site.'}
        </p>
      </div>
    </form>
  );
}

interface StringListEditorProps {
  legend: string;
  name: 'inclusions' | 'exclusions';
  fields: { id: string }[];
  onAppend: () => void;
  onRemove: (index: number) => void;
  register: ReturnType<typeof useForm<TourFormValues>>['register'];
}

/**
 * A repeatable list of bare strings — inclusions and exclusions.
 *
 * Separate from the itinerary/FAQ/tier editors because these items have no
 * fields of their own: they are one line of text each, which is exactly why they
 * are Postgres arrays rather than child tables (see `Tour.inclusions`). Giving
 * them the same three-field card treatment would imply structure that does not
 * exist.
 */
function StringListEditor({ legend, name, fields, onAppend, onRemove, register }: StringListEditorProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <legend className="text-13-5 font-extrabold text-gty-ink">{legend}</legend>
        <Button type="button" size="sm" onClick={onAppend}>
          + Add line
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-12-5 text-gty-subtle">Nothing listed.</p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Label htmlFor={`${name}-${index}`} className="sr-only">
              {legend} line {index + 1}
            </Label>
            <Input id={`${name}-${index}`} {...register(`${name}.${index}` as const)} className="flex-1" />
            <Button type="button" size="sm" onClick={() => onRemove(index)}>
              Remove<span className="sr-only"> {legend} line {index + 1}</span>
            </Button>
          </div>
        ))
      )}
    </fieldset>
  );
}
