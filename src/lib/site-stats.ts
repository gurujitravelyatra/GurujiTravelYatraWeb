import type { CrmSiteSettings } from '@/server/crm/types';

/**
 * The homepage/About Us "in numbers" band's data shape — exactly the 3
 * figures `GET /public/site`'s settings expose. See `StatsBar` for the full
 * rationale (CRM-migration decision 3): `happyTravellersLabel` etc. hold the
 * FIGURE itself (e.g. `"10,000+"`), not a caption, and `undefined` means
 * "not set" — a consumer must hide that one stat, never render a blank box.
 */
export interface SiteStatsSummary {
  happyTravellers?: string;
  destinations?: string;
  yearsExperience?: string;
  showFiguresNote: boolean;
}

export function toSiteStatsSummary(settings: CrmSiteSettings): SiteStatsSummary {
  return {
    happyTravellers: settings.happyTravellersLabel ?? undefined,
    destinations: settings.destinationsLabel ?? undefined,
    yearsExperience: settings.yearsExperienceLabel ?? undefined,
    showFiguresNote: settings.showFiguresNote,
  };
}
