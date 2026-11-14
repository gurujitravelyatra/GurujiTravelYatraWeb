import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { resolveTripFinder } from '@/server/trip-finder/resolve';
import { apiFailure, apiSuccess, handleRoute } from '../_lib/json';

/**
 * `POST /api/trip-finder` — brief §B (2026-11-14): "do the routing on the
 * server... return the target URL, and navigate." The client
 * (`TripFinderBar`) never computes a destination itself; it only POSTs the
 * form state here and navigates to whatever URL comes back.
 *
 * Read-only: calls only the existing cached `getTours()`/`getPlaces()`/
 * `getDepartures()` (see `resolveTripFinder`) — no CRM write, no new
 * server/env/schema surface.
 */
const requestSchema = z.object({
  tab: z.enum(['group', 'spiritual', 'family', 'adventure', 'custom']),
  destination: z.string().max(200).default(''),
  month: z.string().max(40).default(''),
  travellers: z.string().max(20).default(''),
});

export async function POST(request: NextRequest) {
  return handleRoute('POST /api/trip-finder', async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiFailure(400, 'Malformed request body.');
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return apiFailure(400, 'Invalid Trip Finder request.');
    }

    const result = await resolveTripFinder(parsed.data);
    return apiSuccess(result);
  });
}
