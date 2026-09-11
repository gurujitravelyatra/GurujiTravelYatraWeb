export interface StepHeaderProps {
  step: number;
  title: string;
  subtitle: string;
  trailing?: React.ReactNode;
}

/**
 * The numbered red-circle-badge + title + subtitle header repeated on every
 * builder step (export lines 587-588, 610-611, 633-634, 653-654). Shared here
 * so the four step badges stay pixel-identical.
 */
export function StepHeader({ step, title, subtitle, trailing }: StepHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <span className="flex items-start gap-[14px]">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-gty-primary text-14 font-extrabold text-gty-white"
        >
          {step}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-19 leading-[1.2] text-gty-ink">{title}</span>
          <span className="text-13 leading-[1.5] text-gty-subtle">{subtitle}</span>
        </span>
      </span>
      {trailing}
    </div>
  );
}
