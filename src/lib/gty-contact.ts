/**
 * GTY's real, confirmed contact details — the single source of truth.
 *
 * These facts were previously re-typed in four components (`Footer`,
 * `BottomContactStrip`, `MobileActionBar`, `InstagramStrip`), which is how the
 * site ended up showing a WhatsApp link on mobile but not on desktop, and an
 * invented Instagram handle in one place while the Footer's icon pointed at
 * `#`. Anything here is real; anything not confirmed does NOT belong in this
 * file (see `TODO(social-links)` in `Footer.tsx` for the handles that are
 * still unknown).
 */
export const GTY_PHONE_TEL = '+919099957658';
export const GTY_PHONE_DISPLAY = '+91 90999 57658';
export const GTY_WHATSAPP_URL = 'https://wa.me/919099957658';
export const GTY_EMAIL = 'info@gurujitravelyatra.com';
export const GTY_ADDRESS = 'Ahmedabad, Gujarat, India';

/** Confirmed by the business — no underscores (an earlier build invented `guruji_travel_yatra`). */
export const GTY_INSTAGRAM_HANDLE = 'gurujitravelyatra';
export const GTY_INSTAGRAM_URL = `https://www.instagram.com/${GTY_INSTAGRAM_HANDLE}/`;
