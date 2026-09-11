/**
 * Export lines 713-720, the closing band on the `isCustom` screen. Server
 * Component — purely decorative/static, no interactivity. Icons copied
 * verbatim from the export's inline `<svg>`s.
 */
const WHY_CELLS: ReadonlyArray<{ label: [string, string]; path: React.ReactNode }> = [
  {
    label: ['Personalized', 'Itineraries'],
    path: (
      <>
        <circle cx="9" cy="7.5" r="3" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M3 20c0-3.6 2.6-5.8 6-5.8s6 2.2 6 5.8H3zM16 20c0-2.4-.7-4.1-1.9-5.2 3.4-.6 6.9 1.1 6.9 5.2h-5z" />
      </>
    ),
  },
  {
    label: ['Best Price', 'Guarantee'],
    path: <path d="M11 2l9 9-9 9-9-9V4a2 2 0 0 1 2-2h7zm-4 3.4A1.6 1.6 0 1 0 7 8.6a1.6 1.6 0 0 0 0-3.2z" />,
  },
  {
    label: ['Trusted Travel', 'Experts'],
    path: (
      <>
        <circle cx="9" cy="7.5" r="3" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M3 20c0-3.6 2.6-5.8 6-5.8s6 2.2 6 5.8H3zM16 20c0-2.4-.7-4.1-1.9-5.2 3.4-.6 6.9 1.1 6.9 5.2h-5z" />
      </>
    ),
  },
  {
    label: ['24/7', 'Support'],
    path: <path d="M12 3a8 8 0 0 0-8 8v5a2 2 0 0 0 2 2h2v-8H6v1a6 6 0 1 1 12 0v-1h-2v8h2a2 2 0 0 0 2-2v-5a8 8 0 0 0-8-8z" />,
  },
];

export function WhyPlanBand() {
  return (
    <div className="mx-gx mb-[30px] flex flex-wrap items-center gap-6 rounded-18 bg-gty-white p-[22px] shadow-gty-md 760:px-[26px]">
      <h2 className="flex-[0_1_300px] min-w-[250px] border-r border-gty-border-6 pr-5 text-24 leading-[1.2] text-gty-ink">
        Why Plan with <span className="text-gty-primary">Guruji Travel Yatra?</span>
      </h2>

      {WHY_CELLS.map(({ label, path }) => (
        <span key={label.join(' ')} className="flex flex-1 min-w-[170px] items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-pill bg-gty-red-150 text-gty-primary"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="flex-none">
              {path}
            </svg>
          </span>
          <span className="flex flex-col leading-[1.3]">
            <span className="text-13-5 font-semibold text-gty-ink-soft">{label[0]}</span>
            <span className="text-13-5 text-gty-ink-soft">{label[1]}</span>
          </span>
        </span>
      ))}

      <span
        aria-hidden="true"
        className="flex-none border-l border-gty-border-6 pl-[14px] font-script text-22 leading-[1.15] text-gty-ink-soft"
        style={{ transform: 'rotate(-5deg)' }}
      >
        Your Journey
        <br />
        Our Responsibility
        <span className="mt-[2px] block h-[2px] w-[130px] rounded-[2px] bg-gty-primary" />
      </span>
    </div>
  );
}
