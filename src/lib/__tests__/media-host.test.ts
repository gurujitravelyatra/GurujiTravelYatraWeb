import { FALLBACK_MEDIA_HOST, getAllowedMediaHostnames, normalizeMediaHost } from '@/lib/media-host';

describe('normalizeMediaHost', () => {
  it('accepts a full https:// origin', () => {
    expect(normalizeMediaHost('https://media.gurujitravelyatra.com')).toBe('media.gurujitravelyatra.com');
  });

  it('accepts a full https:// origin with a trailing slash', () => {
    expect(normalizeMediaHost('https://media.gurujitravelyatra.com/')).toBe('media.gurujitravelyatra.com');
  });

  it('accepts a bare host with no protocol — the round-2 incident case', () => {
    expect(normalizeMediaHost('media.gurujitravelyatra.com')).toBe('media.gurujitravelyatra.com');
  });

  it('accepts a bare host with a trailing slash', () => {
    expect(normalizeMediaHost('media.gurujitravelyatra.com/')).toBe('media.gurujitravelyatra.com');
  });

  it('rejects an http:// origin — R2 is https-only', () => {
    expect(normalizeMediaHost('http://media.gurujitravelyatra.com')).toBeUndefined();
  });

  it('is undefined, not throwing, for unset/empty', () => {
    expect(normalizeMediaHost(undefined)).toBeUndefined();
    expect(normalizeMediaHost(null)).toBeUndefined();
    expect(normalizeMediaHost('')).toBeUndefined();
    expect(normalizeMediaHost('   ')).toBeUndefined();
  });

  it('is undefined for a malformed value rather than throwing', () => {
    expect(normalizeMediaHost('::not a url::')).toBeUndefined();
  });
});

describe('getAllowedMediaHostnames', () => {
  it('always includes the hard-coded production fallback, even when unset', () => {
    expect(getAllowedMediaHostnames(undefined)).toEqual([FALLBACK_MEDIA_HOST]);
  });

  it('does not duplicate the host when the configured value equals the fallback', () => {
    expect(getAllowedMediaHostnames('https://media.gurujitravelyatra.com')).toEqual([FALLBACK_MEDIA_HOST]);
    expect(getAllowedMediaHostnames('media.gurujitravelyatra.com')).toEqual([FALLBACK_MEDIA_HOST]);
  });

  it('includes both hosts when a different host is configured', () => {
    expect(getAllowedMediaHostnames('https://media-staging.example.com')).toEqual([
      FALLBACK_MEDIA_HOST,
      'media-staging.example.com',
    ]);
  });

  it('falls back to just the fallback host for malformed input, never throwing', () => {
    expect(getAllowedMediaHostnames('::not a url::')).toEqual([FALLBACK_MEDIA_HOST]);
  });
});
