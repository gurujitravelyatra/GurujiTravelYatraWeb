/**
 * @jest-environment node
 */
import { FakeCrmServer } from '@/server/crm/test-support/fake-crm-server';
import type { CrmPlace, CrmTourCard } from '@/server/crm/types';
import { customizeToursUrl, resolveMonthKey, resolveTripFinder } from '../resolve';

const server = new FakeCrmServer();
const originalApiUrl = process.env.CRM_API_URL;

beforeAll(async () => {
  await server.start();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  server.resetState();
  process.env.CRM_API_URL = server.url;
});

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.CRM_API_URL;
  else process.env.CRM_API_URL = originalApiUrl;
});

function tour(overrides: Partial<CrmTourCard>): CrmTourCard {
  return {
    slug: 'tour',
    name: 'A Tour',
    category: 'Adventure',
    shortDescription: '',
    coverImageUrl: '',
    price: null,
    durationDays: 5,
    durationNights: 4,
    departureCity: null,
    primaryPlace: null,
    nextDeparture: null,
    hasBrochure: false,
    ...overrides,
  };
}

function place(overrides: Partial<CrmPlace>): CrmPlace {
  return {
    name: 'Place',
    slug: 'place',
    region: 'Region',
    description: '',
    imageUrl: '',
    showInCustomBuilder: true,
    liveTourCount: 1,
    ...overrides,
  };
}

describe('resolveMonthKey', () => {
  it('resolves this year when the month has not passed yet', () => {
    expect(resolveMonthKey('July', new Date('2026-03-01T00:00:00Z'))).toBe('2026-07');
  });

  it('rolls over to next year once the month has already passed', () => {
    expect(resolveMonthKey('March', new Date('2026-09-01T00:00:00Z'))).toBe('2027-03');
  });

  it('returns undefined for a name that is not a real month', () => {
    expect(resolveMonthKey('Any month')).toBeUndefined();
  });
});

describe('customizeToursUrl', () => {
  it('omits any field left blank', () => {
    expect(customizeToursUrl('', '', '')).toBe('/customize-tours');
  });

  it('carries every provided field as a query param', () => {
    expect(customizeToursUrl('Goa', 'July', '2')).toBe('/customize-tours?destination=Goa&month=July&travellers=2');
  });
});

describe('resolveTripFinder — Custom Trip tab', () => {
  it('always goes straight to Customized Tours, prefilled, never flagged as a fallback', async () => {
    const result = await resolveTripFinder({ tab: 'custom', destination: 'Goa', month: 'July', travellers: '2' });
    expect(result).toEqual({ url: '/customize-tours?destination=Goa&month=July&travellers=2', isFallbackToCustom: false });
  });
});

describe('resolveTripFinder — empty destination (bullet 4)', () => {
  it('Group tab goes to the plain /group-tours listing', async () => {
    const result = await resolveTripFinder({ tab: 'group', destination: '', month: '', travellers: '2' });
    expect(result).toEqual({ url: '/group-tours', isFallbackToCustom: false });
  });

  it('a category tab goes to /tour-packages for that category, no place/month param', async () => {
    const result = await resolveTripFinder({ tab: 'spiritual', destination: '', month: 'July', travellers: '2' });
    expect(result).toEqual({ url: '/tour-packages?category=Spiritual', isFallbackToCustom: false });
  });
});

describe('resolveTripFinder — Spiritual/Family/Adventure tabs (rule 1: month/travellers never filter)', () => {
  it('no match falls back to Customized Tours, prefilled, flagged as a fallback', async () => {
    server.setState({ tours: [tour({ slug: 'kedarnath-yatra', name: 'Kedarnath Yatra', category: 'Spiritual' })] });

    const result = await resolveTripFinder({ tab: 'spiritual', destination: 'Nonexistent Place', month: 'July', travellers: '2' });

    expect(result).toEqual({
      url: '/customize-tours?destination=Nonexistent+Place&month=July&travellers=2',
      isFallbackToCustom: true,
    });
  });

  it('a match (by tour name) goes to /tour-packages filtered by category, ignoring month entirely', async () => {
    server.setState({
      tours: [tour({ slug: 'kedarnath-yatra', name: 'Kedarnath Yatra', category: 'Spiritual', primaryPlace: { name: 'Kedarnath', slug: 'kedarnath' } })],
      places: [place({ name: 'Kedarnath', slug: 'kedarnath', region: 'Uttarakhand' })],
    });

    const result = await resolveTripFinder({ tab: 'spiritual', destination: 'Kedarnath', month: 'July', travellers: '2' });

    expect(result).toEqual({ url: '/tour-packages?category=Spiritual&place=kedarnath', isFallbackToCustom: false });
  });

  it('matches by place REGION ("state") too', async () => {
    server.setState({
      tours: [tour({ slug: 'kerala-family-trip', name: 'Kerala Family Trip', category: 'Family', primaryPlace: { name: 'Munnar', slug: 'munnar' } })],
      places: [place({ name: 'Munnar', slug: 'munnar', region: 'Kerala' })],
    });

    const result = await resolveTripFinder({ tab: 'family', destination: 'Kerala', month: '', travellers: '1' });

    expect(result).toEqual({ url: '/tour-packages?category=Family&place=munnar', isFallbackToCustom: false });
  });

  it('several matches still go to one listing URL, not a direct tour page', async () => {
    server.setState({
      tours: [
        tour({ slug: 'spiti-1', name: 'Spiti Explorer', category: 'Adventure', primaryPlace: { name: 'Spiti', slug: 'spiti' } }),
        tour({ slug: 'spiti-2', name: 'Spiti Circuit', category: 'Adventure', primaryPlace: { name: 'Spiti', slug: 'spiti' } }),
      ],
      places: [place({ name: 'Spiti', slug: 'spiti', region: 'Himachal Pradesh' })],
    });

    const result = await resolveTripFinder({ tab: 'adventure', destination: 'Spiti', month: '', travellers: '2' });

    expect(result.url).toBe('/tour-packages?category=Adventure&place=spiti');
    expect(result.isFallbackToCustom).toBe(false);
  });
});

describe('resolveTripFinder — Group Tour tab (rule 2: real departures)', () => {
  it('one match with no departure data at all goes straight to that tour page', async () => {
    server.setState({ tours: [tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })] });

    const result = await resolveTripFinder({ tab: 'group', destination: 'Char Dham', month: '', travellers: '2' });

    expect(result).toEqual({ url: '/tour-packages/char-dham', isFallbackToCustom: false });
  });

  it('several matches go to /group-tours filtered by the typed destination', async () => {
    server.setState({
      tours: [
        tour({ slug: 'kashmir-1', name: 'Kashmir Group Tour', category: 'Group' }),
        tour({ slug: 'kashmir-2', name: 'Kashmir Family Group Escape', category: 'Group' }),
      ],
    });

    const result = await resolveTripFinder({ tab: 'group', destination: 'Kashmir', month: '', travellers: '2' });

    expect(result).toEqual({ url: '/group-tours?destination=Kashmir', isFallbackToCustom: false });
  });

  it('no match falls back to Customized Tours, prefilled', async () => {
    server.setState({ tours: [] });

    const result = await resolveTripFinder({ tab: 'group', destination: 'Nowhere', month: '', travellers: '2' });

    expect(result).toEqual({ url: '/customize-tours?destination=Nowhere&travellers=2', isFallbackToCustom: true });
  });

  it('a match with a departure in the chosen month goes straight through, no note', async () => {
    server.setState({
      tours: [tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })],
      departures: {
        departures: [
          { ...tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' }), departureDate: resolveMonthKey('July')! + '-10' },
        ],
        months: [],
      },
    });

    const result = await resolveTripFinder({ tab: 'group', destination: 'Char Dham', month: 'July', travellers: '2' });

    expect(result).toEqual({ url: '/tour-packages/char-dham', isFallbackToCustom: false });
  });

  /**
   * The business rule this test pins: a Group tour that matches the
   * destination but has no departure in the chosen month is NEVER treated
   * as "no match" — it still opens, with a note, never a Customized Tours
   * redirect.
   */
  it('a match with departures, but none in the chosen month, still opens with a mismatch note (never redirected to Customized Tours)', async () => {
    const otherMonth = resolveMonthKey('January', new Date('2026-06-01T00:00:00Z'))!;
    server.setState({
      tours: [tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })],
      departures: {
        departures: [{ ...tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' }), departureDate: `${otherMonth}-10` }],
        months: [],
      },
    });

    const result = await resolveTripFinder({ tab: 'group', destination: 'Char Dham', month: 'July', travellers: '2' });

    expect(result.url).toBe('/tour-packages/char-dham');
    expect(result.isFallbackToCustom).toBe(false);
    expect(result.monthMismatchNote).toBe('No departure in July, here are the upcoming dates');
  });

  it('ignores a non-Group departure row that happens to share a slug (defensive, should not occur in real data)', async () => {
    server.setState({
      tours: [tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Group' })],
      departures: {
        departures: [{ ...tour({ slug: 'char-dham', name: 'Char Dham Yatra', category: 'Adventure' }), departureDate: '2026-07-10' }],
        months: [],
      },
    });

    const result = await resolveTripFinder({ tab: 'group', destination: 'Char Dham', month: 'July', travellers: '2' });

    // No REAL Group departure exists for this match at all, so this is the
    // "no departure data" path, not a month mismatch — no note.
    expect(result).toEqual({ url: '/tour-packages/char-dham', isFallbackToCustom: false });
  });
});
