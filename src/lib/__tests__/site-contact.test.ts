import { resolveSiteContact } from '../site-contact';
import { GTY_INSTAGRAM_URL, GTY_PHONE_DISPLAY, GTY_PHONE_TEL, GTY_WHATSAPP_URL } from '../gty-contact';
import type { CrmSiteSettings } from '@/server/crm/types';

/**
 * New brief (2026-11-15): "treat empty or whitespace values from the CRM
 * (phone, whatsappNumber, instagramUrl) the same as null and use the
 * owner's real constants ... Never render an empty phone row."
 *
 * `resolveSiteContact` previously fell back to the static `gty-contact`
 * constants only on `null`/`undefined` (`??`) — a CRM response carrying
 * `""` or `"   "` for one of these three fields sailed straight through as
 * a blank value, which is exactly what every consumer (`Footer`,
 * `Navbar`/`HeaderControls`, `BottomContactStrip`, `MobileActionBar`) then
 * rendered verbatim into a `tel:`/`wa.me`/Instagram `href` with no empty-
 * value guard of its own — they all trust this function to never hand them
 * a blank string.
 */
function settingsWith(overrides: Partial<CrmSiteSettings>): CrmSiteSettings {
  return {
    heroHeadline: null,
    heroSubtext: null,
    happyTravellersLabel: null,
    destinationsLabel: null,
    yearsExperienceLabel: null,
    showFiguresNote: false,
    phone: null,
    whatsappNumber: null,
    email: null,
    instagramUrl: null,
    address: null,
    profileVideoUrl: null,
    ...overrides,
  };
}

describe('resolveSiteContact — blank CRM values fall back exactly like null', () => {
  it('phone: null falls back to the real constant', () => {
    const contact = resolveSiteContact(settingsWith({ phone: null }));
    expect(contact.phoneTel).toBe(GTY_PHONE_TEL);
    expect(contact.phoneDisplay).toBe(GTY_PHONE_DISPLAY);
  });

  it('phone: "" falls back the same as null', () => {
    const contact = resolveSiteContact(settingsWith({ phone: '' }));
    expect(contact.phoneTel).toBe(GTY_PHONE_TEL);
    expect(contact.phoneDisplay).toBe(GTY_PHONE_DISPLAY);
  });

  it('phone: "   " (whitespace only) falls back the same as null', () => {
    const contact = resolveSiteContact(settingsWith({ phone: '   ' }));
    expect(contact.phoneTel).toBe(GTY_PHONE_TEL);
    expect(contact.phoneDisplay).toBe(GTY_PHONE_DISPLAY);
  });

  it('phone: a real CRM value is still used verbatim (no regression)', () => {
    const contact = resolveSiteContact(settingsWith({ phone: '+919812345678' }));
    expect(contact.phoneTel).toBe('+919812345678');
    expect(contact.phoneDisplay).toBe('+919812345678');
  });

  it('whatsappNumber: null falls back to the real constant', () => {
    const contact = resolveSiteContact(settingsWith({ whatsappNumber: null }));
    expect(contact.whatsappUrl).toBe(GTY_WHATSAPP_URL);
  });

  it('whatsappNumber: "" falls back the same as null', () => {
    const contact = resolveSiteContact(settingsWith({ whatsappNumber: '' }));
    expect(contact.whatsappUrl).toBe(GTY_WHATSAPP_URL);
  });

  it('whatsappNumber: "   " (whitespace only) falls back the same as null', () => {
    const contact = resolveSiteContact(settingsWith({ whatsappNumber: '   ' }));
    expect(contact.whatsappUrl).toBe(GTY_WHATSAPP_URL);
  });

  it('whatsappNumber: a real CRM value is still normalised into a wa.me link (no regression)', () => {
    const contact = resolveSiteContact(settingsWith({ whatsappNumber: '+91 98123 45678' }));
    expect(contact.whatsappUrl).toBe('https://wa.me/919812345678');
  });

  it('instagramUrl: null falls back to the real constant', () => {
    const contact = resolveSiteContact(settingsWith({ instagramUrl: null }));
    expect(contact.instagramUrl).toBe(GTY_INSTAGRAM_URL);
  });

  it('instagramUrl: "" falls back the same as null', () => {
    const contact = resolveSiteContact(settingsWith({ instagramUrl: '' }));
    expect(contact.instagramUrl).toBe(GTY_INSTAGRAM_URL);
  });

  it('instagramUrl: "   " (whitespace only) falls back the same as null', () => {
    const contact = resolveSiteContact(settingsWith({ instagramUrl: '   ' }));
    expect(contact.instagramUrl).toBe(GTY_INSTAGRAM_URL);
  });

  it('instagramUrl: a real CRM value is still used verbatim (no regression)', () => {
    const contact = resolveSiteContact(settingsWith({ instagramUrl: 'https://www.instagram.com/someoneelse/' }));
    expect(contact.instagramUrl).toBe('https://www.instagram.com/someoneelse/');
  });

  // The failure mode this whole brief is about: every consumer builds its
  // href directly from these fields with no blank-guard of its own (see
  // Footer.tsx/Navbar.tsx/BottomContactStrip.tsx/MobileActionBar.tsx) — so
  // an empty phoneTel/whatsappUrl would render a `tel:` / `wa.me` link to
  // nowhere rather than no link at all. These three fields must never
  // resolve to an empty or whitespace-only string.
  it('never resolves phoneTel/phoneDisplay/whatsappUrl/instagramUrl to a blank string, for any blank CRM input', () => {
    for (const blank of [null, '', '   '] as const) {
      const contact = resolveSiteContact(
        settingsWith({ phone: blank, whatsappNumber: blank, instagramUrl: blank })
      );
      expect(contact.phoneTel.trim()).not.toBe('');
      expect(contact.phoneDisplay.trim()).not.toBe('');
      expect(contact.whatsappUrl.trim()).not.toBe('');
      expect(contact.instagramUrl.trim()).not.toBe('');
    }
  });

  it('a null settings object (CRM unreachable) resolves every field to the real constants', () => {
    const contact = resolveSiteContact(null);
    expect(contact.phoneTel).toBe(GTY_PHONE_TEL);
    expect(contact.phoneDisplay).toBe(GTY_PHONE_DISPLAY);
    expect(contact.whatsappUrl).toBe(GTY_WHATSAPP_URL);
    expect(contact.instagramUrl).toBe(GTY_INSTAGRAM_URL);
  });
});
