import { FALLBACK_MEDIA_HOST } from '@/lib/media-host';
import { buildMediaHostRemotePatterns } from '@/lib/media-remote-patterns';

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

  it('accepts a bare host — the round-2 incident case — and still produces one entry', () => {
    expect(buildMediaHostRemotePatterns('media.gurujitravelyatra.com')).toEqual([
      { protocol: 'https', hostname: FALLBACK_MEDIA_HOST, pathname: '/**' },
    ]);
  });

  it('includes both hosts when a different host is configured', () => {
    const patterns = buildMediaHostRemotePatterns('https://media-staging.example.com');
    const hostnames = patterns.map((p) => p.hostname);
    expect(hostnames).toContain(FALLBACK_MEDIA_HOST);
    expect(hostnames).toContain('media-staging.example.com');
  });
});
