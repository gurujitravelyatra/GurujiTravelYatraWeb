/**
 * @jest-environment node
 */

/**
 * `saveTourAction` — the M7 (concurrent edit) and missing-tour paths.
 *
 * The repository's half is proven against real Postgres in
 * `tour-repository.integration.test.ts`; this pins what the ACTION does with
 * each outcome: a conflict comes back as state (so the editor keeps the
 * admin's input) and is never followed by a redirect, a revalidation, or a
 * retry.
 */

const mockRequireAdminSession = jest.fn();
const mockUpdateTour = jest.fn();
const mockCreateTour = jest.fn();
const mockFindSlugConflict = jest.fn();
const mockRedirect = jest.fn((url: string) => {
  throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` });
});
const mockRevalidatePath = jest.fn();

jest.mock('@/server/auth/session', () => ({
  requireAdminSession: () => mockRequireAdminSession(),
}));

jest.mock('@/server/admin/tours/tour-repository', () => ({
  updateTour: (...args: unknown[]) => mockUpdateTour(...args),
  createTour: (...args: unknown[]) => mockCreateTour(...args),
  findSlugConflict: (...args: unknown[]) => mockFindSlugConflict(...args),
  getAdminTourBySlug: jest.fn(),
  setTourArchived: jest.fn(),
  setTourStatus: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: (path: string) => mockRevalidatePath(path) }));
jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  // The real one rethrows Next's control-flow errors; the redirect mock above
  // is the only one this file produces.
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') throw error;
  },
}));

import { saveTourAction } from '../actions';
import { EMPTY_FORM_STATE } from '../form-state';

const LOADED_AT = '2026-09-19T10:00:00.000Z';

const FORM_VALUES = {
  name: 'Spiti Valley Circuit',
  slug: 'spiti-valley-circuit',
  destinationSlug: 'spiti-valley',
  category: 'Adventure',
  audienceTags: [],
  isHot: false,
  inclusions: [],
  exclusions: [],
  itineraryDays: [],
  faqs: [],
  pricingTiers: [],
  galleryImages: [],
};

function editSubmission(overrides: Record<string, string | null> = {}): FormData {
  const fields: Record<string, string | null> = {
    intent: 'draft',
    payload: JSON.stringify(FORM_VALUES),
    editingSlug: 'spiti-valley-circuit',
    expectedUpdatedAt: LOADED_AT,
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== null) formData.append(key, value);
  return formData;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindSlugConflict.mockResolvedValue({ configured: true, value: { taken: false } });
  mockUpdateTour.mockResolvedValue({ configured: true, value: { outcome: 'saved', slug: 'spiti-valley-circuit' } });
});

describe('an edit carries the version it was loaded at', () => {
  it('passes the token to the repository as an exact instant', async () => {
    await expect(saveTourAction(EMPTY_FORM_STATE, editSubmission())).rejects.toThrow('NEXT_REDIRECT');

    expect(mockUpdateTour).toHaveBeenCalledTimes(1);
    const version = mockUpdateTour.mock.calls[0][3] as Date;
    expect(version).toBeInstanceOf(Date);
    expect(version.toISOString()).toBe(LOADED_AT);
  });

  it.each([
    ['absent', null],
    ['empty', ''],
    ['not an ISO instant', 'yesterday'],
    ['a date without milliseconds', '2026-09-19T10:00:00Z'],
  ])('refuses an edit whose version is %s — and writes nothing', async (_label, token) => {
    const state = await saveTourAction(EMPTY_FORM_STATE, editSubmission({ expectedUpdatedAt: token }));

    expect(state.error).toMatch(/reload the page/i);
    expect(mockUpdateTour).not.toHaveBeenCalled();
  });

  it('does not require a version to CREATE a tour', async () => {
    mockCreateTour.mockResolvedValue({ configured: true, value: { slug: 'spiti-valley-circuit' } });

    await expect(
      saveTourAction(EMPTY_FORM_STATE, editSubmission({ editingSlug: null, expectedUpdatedAt: null }))
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreateTour).toHaveBeenCalledTimes(1);
  });
});

describe('a save that lost the race', () => {
  beforeEach(() => {
    mockUpdateTour.mockResolvedValue({ configured: true, value: { outcome: 'conflict' } });
  });

  it('returns a conflict STATE rather than redirecting, so the editor keeps what was typed', async () => {
    const state = await saveTourAction(EMPTY_FORM_STATE, editSubmission());

    expect(state.conflict).toBe(true);
    expect(state.error).toMatch(/someone else saved changes/i);
    expect(state.error).toMatch(/have NOT been saved/);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('revalidates nothing — nothing changed', async () => {
    await saveTourAction(EMPTY_FORM_STATE, editSubmission());
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does not retry the save', async () => {
    await saveTourAction(EMPTY_FORM_STATE, editSubmission());
    expect(mockUpdateTour).toHaveBeenCalledTimes(1);
  });
});

describe('a save of a tour that no longer exists', () => {
  it('says so, rather than the generic "Saving failed"', async () => {
    mockUpdateTour.mockResolvedValue({ configured: true, value: { outcome: 'missing' } });

    const state = await saveTourAction(EMPTY_FORM_STATE, editSubmission());

    expect(state.error).toMatch(/no longer exists/i);
    expect(state.conflict).toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
