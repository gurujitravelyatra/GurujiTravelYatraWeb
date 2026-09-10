import fs from 'fs';
import path from 'path';

/**
 * Tech spec §9 item 1, adapted per BLOCKERS.md / the actual repo shape: there
 * is no `tailwind.config.ts` (Tailwind v4 is CSS-first here — see the header
 * comment in globals.css). The equivalent guard against silent token drift
 * is asserting the `@theme` block in `src/app/globals.css` still declares
 * every required `--color-gty-*`, `--radius-*` and `--shadow-gty-*` key from
 * tech spec §6.4.
 */
describe('design tokens (globals.css @theme)', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

  function themeBlock(): string {
    const match = css.match(/@theme\s*{([\s\S]*?)\n}/);
    if (!match) {
      throw new Error('No @theme block found in globals.css');
    }
    return match[1];
  }

  const theme = themeBlock();

  it('declares the @theme block at all', () => {
    expect(css).toMatch(/@theme\s*{/);
  });

  const requiredColorTokens = [
    '--color-gty-primary',
    '--color-gty-primary-deep',
    '--color-gty-primary-darker',
    '--color-gty-ink',
    '--color-gty-ink-soft',
    '--color-gty-body',
    '--color-gty-muted',
    '--color-gty-subtle',
    '--color-gty-placeholder',
    '--color-gty-white',
    '--color-gty-whatsapp',
    '--color-gty-green-bg',
    '--color-gty-green-border',
    '--color-gty-green-text',
  ];

  it.each(requiredColorTokens)('declares color token %s', (token) => {
    expect(theme).toMatch(new RegExp(`${token}\\s*:`));
  });

  const requiredRadiusTokens = [
    '--radius-2',
    '--radius-8',
    '--radius-14',
    '--radius-16',
    '--radius-18',
    '--radius-22',
    '--radius-24',
    '--radius-30',
    '--radius-44',
    '--radius-pill',
  ];

  it.each(requiredRadiusTokens)('declares radius token %s', (token) => {
    expect(theme).toMatch(new RegExp(`${token}\\s*:`));
  });

  const requiredShadowTokens = [
    '--shadow-gty-card',
    '--shadow-gty-card-hover',
    '--shadow-gty-header',
    '--shadow-gty-modal',
    '--shadow-gty-btn',
    '--shadow-gty-whatsapp',
  ];

  it.each(requiredShadowTokens)('declares shadow token %s', (token) => {
    expect(theme).toMatch(new RegExp(`${token}\\s*:`));
  });

  it('declares the six export breakpoints', () => {
    for (const bp of ['640', '760', '860', '1080', '1180', '1300']) {
      expect(theme).toMatch(new RegExp(`--breakpoint-${bp}\\s*:\\s*${bp}px`));
    }
  });

  it('declares the motion duration/easing tokens (never a spring, never a different curve)', () => {
    expect(theme).toMatch(/--duration-gty-fast\s*:\s*150ms/);
    expect(theme).toMatch(/--duration-gty-card\s*:\s*180ms/);
    expect(theme).toMatch(/--ease-gty\s*:\s*cubic-bezier\(0\.25,\s*0\.1,\s*0\.25,\s*1\)/);
  });
});
