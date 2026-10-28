import {
  FALLBACK_MEDIA_HOST,
  buildMediaHostRemotePatterns,
  normalizeMediaHost,
} from '@/lib/media-remote-patterns';

describe('normalizeMediaHost', () => {
  it('accepts a full https:// origin', () => {
    expect(normalizeMediaHost('https://media.gurujitravelyatra.com')).toBe('media.gurujitravelyatra.com');
  });

  it('accepts a full https:// origin with a trailing slash', () => {
    expect(normalizeMediaHost('https://media.gurujitravelyatra.com/')).toBe('media.gurujitravelyatra.com');
  });

  it('accepts a bare host with no protocol — the production incident case', () => {
    expect(normalizeMediaHost('media.gurujitravelyatra.com')).toBe('media.gurujitravelyatra.com');
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

describe('buildMediaHostRemotePatterns', () => {
  it('always includes the hard-coded production fallback host, even when unset', () => {
    const patterns = buildMediaHostRemotePatterns(undefined);
    expect(patterns).toEqual([{ protocol: 'https', hostname: FALLBACK_MEDIA_HOST, pathname: '/**' }]);
  });

  it('allows every path under the host, not just /place-images/ and /tour-images/', () => {
    const patterns = buildMediaHostRemotePatterns('https://media.gurujitravelyatra.com');
    const ownHost = patterns.find((p) => p.hostname === 'media.gurujitravelyatra.com');
    expect(ownHost?.pathname).toBe('/**');
  });

  it('does not duplicate the host when the configured value equals the fallback', () => {
    const patterns = buildMediaHostRemotePatterns('https://media.gurujitravelyatra.com');
    expect(patterns).toHaveLength(1);
  });

  it('includes both hosts when a different host is configured', () => {
    const patterns = buildMediaHostRemotePatterns('https://media-staging.example.com');
    const hostnames = patterns.map((p) => p.hostname);
    expect(hostnames).toContain(FALLBACK_MEDIA_HOST);
    expect(hostnames).toContain('media-staging.example.com');
  });

  it('still returns just the fallback for a bare-host or malformed input', () => {
    expect(buildMediaHostRemotePatterns('media.gurujitravelyatra.com')).toEqual([
      { protocol: 'https', hostname: FALLBACK_MEDIA_HOST, pathname: '/**' },
    ]);
    expect(buildMediaHostRemotePatterns('::not a url::')).toEqual([
      { protocol: 'https', hostname: FALLBACK_MEDIA_HOST, pathname: '/**' },
    ]);
  });
});
