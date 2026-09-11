// @ts-check
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Starts the Next.js **standalone** server the same way ./Dockerfile's `runner`
 * stage does.
 *
 * Why this exists: next.config.ts sets `output: "standalone"`, which changes
 * what `next build` emits — the served app becomes `.next/standalone/server.js`
 * (its own minimal server, with traced `node_modules` and its own copy of the
 * build), not the app that `next start` boots. Running `next start` against a
 * standalone build makes Next print:
 *
 *   "next start" does not work with "output: standalone" configuration.
 *   Use "node .next/standalone/server.js" instead.
 *
 * It still comes up, which is exactly why the mismatch was easy to miss: the
 * E2E suite was green against a server that production never runs. Anything
 * that breaks *only* in standalone — a dependency missed by output file
 * tracing, a static asset that isn't copied next to the server — could not be
 * caught by a passing test run.
 *
 * The copy steps below are not incidental: a standalone build deliberately
 * omits `public/` and `.next/static/`, on the assumption the deployment puts
 * them back (Next's own docs, and the Dockerfile's two COPY lines). Skipping
 * them yields a server that answers HTML but 404s every asset. Mirroring them
 * here means the layout the Dockerfile depends on is now exercised on every
 * E2E run, so a future change that breaks it fails a test instead of a deploy.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const standaloneDir = join(root, '.next', 'standalone');
const serverEntry = join(standaloneDir, 'server.js');

if (!existsSync(serverEntry)) {
  console.error(
    `Standalone server not found at ${serverEntry}.\n` +
      'Run `npm run build` first, and check that next.config.ts still sets `output: "standalone"`.'
  );
  process.exit(1);
}

// Mirrors Dockerfile `runner`:
//   COPY --from=builder /app/public ./public
//   COPY --from=builder /app/.next/static ./.next/static
// `public/` is optional in a Next app; `.next/static/` is not, so a missing
// one is a real build problem rather than something to paper over.
const staticDir = join(root, '.next', 'static');
if (!existsSync(staticDir)) {
  console.error(`Expected ${staticDir} to exist after \`next build\`. Aborting rather than serving an assetless app.`);
  process.exit(1);
}
cpSync(staticDir, join(standaloneDir, '.next', 'static'), { recursive: true });

const publicDir = join(root, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, join(standaloneDir, 'public'), { recursive: true });
}

// Next's standalone entrypoint reads both of these, defaulting to 0.0.0.0:3000.
// Binding to loopback keeps a test run from listening on every interface.
const child = spawn(process.execPath, [serverEntry], {
  cwd: standaloneDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT ?? '3000',
    HOSTNAME: process.env.HOSTNAME ?? '127.0.0.1',
  },
});

// Forward termination so Playwright's webServer teardown actually stops the
// server instead of orphaning it and leaving the port held for the next run.
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
