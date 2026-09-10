/**
 * Deterministic kebab-case slug helper for fixture content.
 *
 * Used so `Package.slug` and `Destination.slug` never have to be hand-typed
 * next to the transcribed fixture data (which would drift). Given the same
 * input string, this always produces the same slug — lowercase, spaces and
 * punctuation collapsed to single hyphens, leading/trailing hyphens trimmed.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
