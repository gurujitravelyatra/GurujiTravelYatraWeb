import type { CrmSiteSettings } from '@/server/crm/types';
import {
  GTY_ADDRESS,
  GTY_EMAIL,
  GTY_INSTAGRAM_URL,
  GTY_PHONE_DISPLAY,
  GTY_PHONE_TEL,
  GTY_WHATSAPP_URL,
} from './gty-contact';

/**
 * The CRM is now the single source of truth for contact info
 * (`GET /public/site`'s `settings`), but every field there is `null` until
 * the Owner has saved it at least once — the contract states this
 * explicitly, with no backfill. Falling back to a blank phone number on a
 * real, live business site is worse than falling back to the last confirmed
 * values this repo has (`@/lib/gty-contact`), so every field here prefers
 * the CRM value and falls back to the static constant only when the CRM
 * has not set one yet.
 *
 * This is a TRANSITIONAL safety net, not an invented fact — every value in
 * `gty-contact.ts` is itself a real, previously-confirmed business fact, not
 * a guess. Once the Owner fills in `/public/site` for real, every field here
 * reads from the CRM and the static file becomes dead weight (removing it is
 * a later cleanup once that is confirmed to have happened).
 */
export interface SiteContact {
  phoneTel: string;
  phoneDisplay: string;
  whatsappUrl: string;
  email: string;
  address: string;
  /**
   * A Google Maps link for `address` (brief §D, 2026-11-14). The CRM
   * contract has no latitude/longitude field on `CrmSiteSettings` — only
   * `address` free text — so this is always the documented
   * `maps.google.com` text-search fallback the brief itself names for that
   * case, never a pin built from coordinates that do not exist here.
   */
  addressMapsUrl: string;
  instagramUrl: string;
  /** `null` when the CRM has not set one — never invented. */
  heroHeadline: string | null;
  heroSubtext: string | null;
  profileVideoUrl: string | null;
}

function normalizedWhatsappUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length > 0 ? `https://wa.me/${digits}` : null;
}

function buildAddressMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * `?? GTY_X` only catches `null`/`undefined` — a CRM field that comes back
 * as `""` or `"   "` (the Owner cleared a field in the CRM UI without
 * actually unsetting it, or a backend quirk serialises "not set" as an
 * empty string rather than `null`) sailed straight through as a blank
 * value, which is exactly the "never render an empty phone row" failure
 * this treats identically to `null` instead.
 */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveSiteContact(settings: CrmSiteSettings | null): SiteContact {
  const phone = blankToNull(settings?.phone);
  const address = settings?.address ?? GTY_ADDRESS;
  return {
    phoneTel: phone ?? GTY_PHONE_TEL,
    phoneDisplay: phone ?? GTY_PHONE_DISPLAY,
    whatsappUrl: normalizedWhatsappUrl(blankToNull(settings?.whatsappNumber)) ?? GTY_WHATSAPP_URL,
    email: settings?.email ?? GTY_EMAIL,
    address,
    addressMapsUrl: buildAddressMapsUrl(address),
    instagramUrl: blankToNull(settings?.instagramUrl) ?? GTY_INSTAGRAM_URL,
    heroHeadline: settings?.heroHeadline ?? null,
    heroSubtext: settings?.heroSubtext ?? null,
    profileVideoUrl: settings?.profileVideoUrl ?? null,
  };
}
