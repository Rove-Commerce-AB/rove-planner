"use client";

import type { AllocationHistoryEntry } from "@/types";

type Props = {
  entries: AllocationHistoryEntry[];
  loading: boolean;
};

export function AllocationHistoryTable({ entries, loading }: Props) {
  return (
    <div className="rounded border border-border bg-panel px-4 py-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">
        Recent allocation changes
      </h3>
      {loading ? (
        <p className="text-sm text-text-primary opacity-70">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-text-primary opacity-70">
          No allocation history yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-medium uppercase tracking-wider text-text-primary">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Customer - Project</th>
                <th className="px-4 py-3">Consultant</th>
                <th className="px-4 py-3">Week</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Changed by</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        entry.action === "create" || entry.action === "bulk"
                          ? "text-green-600"
                          : entry.action === "delete"
                            ? "text-red-600"
                            : entry.action === "update"
                              ? "text-amber-600"
                              : "text-text-primary"
                      }
                    >
                      {entry.action === "create"
                        ? "Added"
                        : entry.action === "delete"
                          ? "Removed"
                          : entry.action === "update"
                            ? "Updated"
                            : "Added"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-primary">
                    {entry.customer_name != null && entry.project_name != null
                      ? `${entry.customer_name} – ${entry.project_name}`
                      : entry.project_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary">
                    {entry.consultant_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary">
                    {entry.week_range
                      ? entry.week_range.replace(/\d{4}-W?/g, "").replace(/W/g, "")
                      : entry.year != null && entry.week != null
                        ? String(entry.week).padStart(2, "0")
                        : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary">
                    {entry.hours != null ? `${entry.hours}h` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary">
                    {entry.changed_by_email}
                  </td>
                  <td className="px-4 py-2.5 text-text-primary opacity-80">
                    {new Date(entry.changed_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
