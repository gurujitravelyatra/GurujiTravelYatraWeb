import type { StatMetric } from '@/content/types';

export interface StatsBarProps {
  stats: StatMetric[];
}

/** Export lines 330-336, tech spec §4.4 row 11. */
export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div data-testid="section-11-stats" className="bg-gty-surface-5 px-gx pb-[34px]">
      <div className="flex flex-wrap overflow-hidden rounded-16 bg-gty-primary shadow-gty-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-[110px] flex-1 flex-col items-center gap-[9px] px-3 py-[30px]">
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-pill bg-gty-white/16 text-16 text-gty-white">
              {stat.icon}
            </span>
            <p className="text-[30px] font-extrabold leading-none text-gty-white">{stat.value}</p>
            <p className="text-13-5 text-gty-white/88">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
