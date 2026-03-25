"use client";

import type { RoleOccupancyRow } from "@/types/occupancyReport";
import { getMonthSpansForWeeks } from "@/lib/dateUtils";
import { Panel, PanelSectionTitle } from "@/components/ui";

type Props = {
  rows: RoleOccupancyRow[];
  currentYear: number;
  currentWeek: number;
};

/** Same scale as allocation table percentage cells. */
function getOccupancyCellBgClass(pct: number): string {
  if (pct === 0) return "bg-bg-muted/20";
  if (pct < 50) return "bg-danger/18";
  if (pct < 75) return "bg-danger/10";
  if (pct < 95) return "bg-success/10";
  if (pct <= 105) return "bg-success/20";
  if (pct <= 120) return "bg-brand-blue/14";
  return "bg-brand-blue/25";
}

export function RoleOccupancyPanel({
  rows,
  currentYear,
  currentWeek,
}: Props) {
  const weekCount =
    rows.length > 0 && rows[0].weeks.length > 0 ? rows[0].weeks.length : 0;
  const weeks =
    weekCount > 0 ? rows[0].weeks.map((w) => ({ year: w.year, week: w.week })) : [];
  const monthSpans = getMonthSpansForWeeks(weeks);
  const isCurrentWeek = (year: number, week: number) =>
    year === currentYear && week === currentWeek;

  return (
    <Panel>
      <PanelSectionTitle>OCCUPANCY BY ROLE</PanelSectionTitle>
      <div className="overflow-x-auto p-3 pt-0">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-primary opacity-70">
            No roles to display.
          </p>
        ) : (
          <table className="w-full min-w-0 border-collapse text-sm">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="w-0 max-w-[6rem] border-b border-r border-panel py-2 pr-2 text-left text-xs font-medium text-text-primary opacity-80"
                >
                  Role
                </th>
                {monthSpans.map((span, i) => (
                  <th
                    key={i}
                    colSpan={span.colSpan}
                    className="w-0 min-w-[2.25rem] border-b border-panel px-0.5 py-1 text-center text-xs font-medium uppercase tracking-wide text-text-primary opacity-60"
                  >
                    {span.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-panel">
                {weeks.map((w, i) => (
                  <th
                    key={`${w.year}-${w.week}`}
                    className={`w-0 min-w-[2.25rem] border-r border-panel/60 px-1 py-1 text-center text-xs font-medium text-text-primary opacity-80 ${
                      isCurrentWeek(w.year, w.week)
                        ? "current-week-header bg-brand-signal/20 border-l border-r"
                        : ""
                    }`}
                  >
                    v{w.week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.roleId || "all"}
                  className="border-b border-panel/60 last:border-b-0"
                >
                  <td className="max-w-[6rem] truncate border-r border-panel/60 py-2 pr-2 font-medium text-text-primary">
                    {row.roleName}
                  </td>
                  {Array.from({ length: weekCount }, (_, i) => {
                    const wk = row.weeks[i];
                    const p = row.points[i];
                    const current = wk && isCurrentWeek(wk.year, wk.week);
                    if (p == null) {
                      return (
                        <td
                          key={i}
                          className={`px-1 py-1.5 text-center text-xs text-text-primary opacity-40 ${
                            current ? "bg-brand-signal/15 border-l border-r border-brand-signal/30" : ""
                          }`}
                        >
                          —
                        </td>
                      );
                    }
                    const pct = p.occupancyExkl;
                    return (
                      <td
                        key={wk?.label ?? i}
                        className={`w-0 min-w-[2.25rem] border-r border-panel/60 px-1 py-1.5 text-center text-xs tabular-nums text-text-primary ${getOccupancyCellBgClass(pct)} ${
                          current ? "current-week-cell bg-brand-signal/15 border-l border-r border-brand-signal/30" : ""
                        }`}
                      >
                        {pct}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}
