import type { ConsultantAllocation } from "@/types";
import { DEFAULT_HOURS_PER_WEEK } from "@/lib/constants";


type Props = {
  allocations: ConsultantAllocation[];
  currentWeek: number;
  currentYear: number;
};

function formatWeekLabel(week: number, year: number) {
  return `v${week} ${year}`;
}

export function AllocationPerWeek({
  allocations,
  currentWeek,
  currentYear,
}: Props) {
  const weekLabels = Array.from({ length: 6 }, (_, i) =>
    formatWeekLabel(currentWeek + i, currentYear)
  );

  return (
    <div className="rounded-lg border border-border bg-bg-default p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        Allocation per week
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 text-left font-medium text-text-primary opacity-80">
                Consultant
              </th>
              {weekLabels.map((label) => (
                <th
                  key={label}
                  className="px-2 py-3 text-center font-medium text-text-primary opacity-80"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allocations.map(({ consultant, weeks }, idx) => (
              <tr
                key={consultant.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-muted text-xs font-medium text-text-primary"
                      aria-hidden
                    >
                      {consultant.initials}
                    </div>
                    <div>
                      <p className="font-medium text-text-primary">
                        {consultant.name}
                      </p>
                      <p className="text-xs text-text-primary opacity-60">
                        {consultant.title}
                      </p>
                    </div>
                  </div>
                </td>
                {weeks.map((w, i) => (
                  <td key={i} className="px-2 py-3">
                    {w.hours > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-2 w-full max-w-[60px] overflow-hidden rounded bg-bg-muted">
                          <div
                            className="h-full rounded"
                            style={{
                              backgroundColor: w.projectColor || "var(--color-text-muted)",
                              width: `${Math.min(100, (w.hours / (w.availableHours ?? DEFAULT_HOURS_PER_WEEK)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-text-primary opacity-80">
                          {w.hours}h
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-primary opacity-40">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
