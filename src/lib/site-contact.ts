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

export function resolveSiteContact(settings: CrmSiteSettings | null): SiteContact {
  return {
    phoneTel: settings?.phone ?? GTY_PHONE_TEL,
    phoneDisplay: settings?.phone ?? GTY_PHONE_DISPLAY,
    whatsappUrl: normalizedWhatsappUrl(settings?.whatsappNumber ?? null) ?? GTY_WHATSAPP_URL,
    email: settings?.email ?? GTY_EMAIL,
    address: settings?.address ?? GTY_ADDRESS,
    instagramUrl: settings?.instagramUrl ?? GTY_INSTAGRAM_URL,
    heroHeadline: settings?.heroHeadline ?? null,
    heroSubtext: settings?.heroSubtext ?? null,
    profileVideoUrl: settings?.profileVideoUrl ?? null,
  };
}
