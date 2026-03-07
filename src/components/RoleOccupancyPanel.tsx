"use client";

import { Users } from "lucide-react";
import type { RoleOccupancyRow } from "@/lib/occupancyReport";
import { Panel } from "@/components/ui";

const panelHeaderBorder = "border-panel";

type Props = {
  rows: RoleOccupancyRow[];
};

function occupancyColor(pct: number): string {
  if (pct <= 0) return "text-text-primary opacity-50";
  if (pct <= 95) return "text-text-primary";
  if (pct <= 100) return "text-brand-signal";
  return "text-amber-600 dark:text-amber-400";
}

function occupancyBg(pct: number): string {
  if (pct <= 0) return "bg-transparent";
  if (pct <= 95) return "bg-brand-signal/10";
  if (pct <= 100) return "bg-brand-signal/15";
  return "bg-amber-500/15";
}

export function RoleOccupancyPanel({ rows }: Props) {
  const weekLabels =
    rows.length > 0 && rows[0].weeks.length > 0
      ? rows[0].weeks.slice(0, 10).map((w) => w.label)
      : [];

  return (
    <Panel>
      <div
        className={`flex items-center gap-2 border-b ${panelHeaderBorder} bg-bg-muted/40 px-4 py-3`}
      >
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-primary opacity-70">
          <Users className="h-4 w-4" />
          Occupancy by role — next 10 weeks
        </h2>
      </div>
      <div className="overflow-x-auto p-4">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-primary opacity-70">
            No roles to display.
          </p>
        ) : (
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-panel py-2 pr-4 text-left font-medium text-text-primary opacity-80">
                  Role
                </th>
                {weekLabels.map((label) => (
                  <th
                    key={label}
                    className="border-b border-panel px-2 py-2 text-center font-medium text-text-primary opacity-80"
                  >
                    {label}
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
                  <td className="py-2.5 pr-4 font-medium text-text-primary">
                    {row.roleName}
                  </td>
                  {Array.from({ length: 10 }, (_, i) => {
                    const p = row.points[i];
                    if (p == null) {
                      return (
                        <td
                          key={i}
                          className="px-2 py-2 text-center text-text-primary opacity-40"
                        >
                          —
                        </td>
                      );
                    }
                    const pct = p.occupancyExkl;
                    return (
                      <td
                        key={row.weeks[i]?.label ?? i}
                        className={`px-2 py-2 text-center ${occupancyBg(pct)} ${occupancyColor(pct)}`}
                      >
                        <span className="tabular-nums">{pct}%</span>
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
