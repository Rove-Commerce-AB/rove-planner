import type { TimeReportCustomerGroup, TimeReportEntry } from "@/types";

export type { TimeReportCustomerGroup, TimeReportEntry };

export function newTimeReportEntry(): TimeReportEntry {
  return {
    id: crypto.randomUUID(),
    projectId: "",
    roleId: "",
    jiraDevOpsValue: "",
    task: "",
    hours: [0, 0, 0, 0, 0, 0, 0],
    comments: {},
  };
}

export function cloneTimeReportGroupsWithNewIds(
  groups: TimeReportCustomerGroup[]
): TimeReportCustomerGroup[] {
  return groups.map((g) => ({
    customerId: g.customerId,
    entries: g.entries.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      task: e.task ?? "",
      hours: [...e.hours],
      comments: { ...e.comments },
    })),
  }));
}

export function timeReportEntryHasContent(entry: TimeReportEntry): boolean {
  const hasHours = entry.hours.some((h) => (h ?? 0) > 0);
  const hasComment = Object.values(entry.comments).some(
    (c) => (c ?? "").trim() !== ""
  );
  return hasHours || hasComment;
}

export function timeReportTaskCacheKey(
  customerId: string,
  projectId: string
) {
  return `${customerId}-${projectId || ""}`;
}

export function timeReportGroupTotalHours(
  entries: TimeReportEntry[]
): number {
  return entries.reduce(
    (sum, e) => sum + e.hours.reduce((s, h) => s + h, 0),
    0
  );
}

export function timeReportDayTotals(entries: TimeReportEntry[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const e of entries) {
    e.hours.forEach((h, i) => {
      out[i] += h;
    });
  }
  return out;
}
