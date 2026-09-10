import Image from 'next/image';

/**
 * SCAFFOLD PLACEHOLDER — not the real Home page.
 *
 * The real Home page build is BLOCKED pending product decisions (see
 * documentation/technical-specification/BLOCKERS.md). This placeholder exists
 * so the app builds and so the extracted design tokens are visually verifiable.
 * Replace it wholesale when Home is unblocked.
 */
export default function Page() {
  return (
    <main className="sec mx-auto max-w-[900px]">
      <div className="mb-8 flex items-center gap-[11px]">
        <span className="block h-[56px] w-[74px] flex-none overflow-hidden">
          <Image
            src="/logo/gty-logo.png"
            alt="Guruji Travel Yatra"
            width={74}
            height={74}
            className="h-[74px] w-[74px] object-cover object-top"
            priority
          />
        </span>
        <span className="flex flex-col items-start gap-[5px]">
          <span className="text-20 font-extrabold leading-none tracking-nudge text-gty-ink">
            GURUJI TRAVEL YATRA
          </span>
          <span className="text-9 uppercase tracking-widest-gty text-gty-subtle">
            Keep Guessing, Where&apos;s Next Trip?
          </span>
        </span>
      </div>

      <div className="rounded-16 border border-gty-border bg-gty-white p-6 shadow-gty-card">
        <p className="text-10 font-bold uppercase tracking-label text-gty-subtle">
          Scaffold status
        </p>
        <h1 className="mt-2 text-29 font-extrabold tracking-tightest text-gty-ink">
          Design tokens are wired.
        </h1>
        <p className="mt-3 text-13-5 leading-relaxed text-gty-body">
          Next.js + TypeScript + Tailwind v4 + <span className="font-script text-17 text-gty-primary">next/font</span>{' '}
          are configured, and every colour, radius, shadow and type step from the
          Claude Design export is available as a token.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-pill bg-gty-primary px-5 py-3 text-11-5 font-bold text-gty-white shadow-gty-btn">
            Primary #d80000
          </span>
          <span className="rounded-pill border-[1.5px] border-gty-border-3 bg-gty-white px-5 py-3 text-11-5 font-bold text-gty-ink">
            Pill 99px
          </span>
          <span className="rounded-pill bg-gty-red-150 px-5 py-3 text-11-5 font-bold text-gty-primary">
            Tint #fdeceb
          </span>
        </div>
      </div>

      <p className="mt-8 text-12 text-gty-subtle">
        Page and component implementation is paused pending product decisions —
        see <code className="text-gty-ink">documentation/technical-specification/BLOCKERS.md</code>.
      </p>
    </main>
  );
}
