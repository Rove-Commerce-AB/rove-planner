/**
 * Month-view merge of ISO-week time report slices.
 * A merged row groups multiple week payloads that describe the same logical line.
 *
 * Merge identity: customerId + projectId + roleId + jira key + trimmed task + displayOrder.
 * Including displayOrder keeps distinct grid rows that share project/role/jira/task apart.
 * Month-to-next-month copy must use the same displayOrder on every target ISO week so this key
 * stays stable across weeks (see copyEntryToWeek lineDisplayOrder).
 */

import type { TimeReportCustomerGroup, TimeReportEntry } from "@/types";
import { getWeekDates, weekSliceKey } from "@/lib/timeReportBrowserWeek";

export type TimeReportMonthCustomerOption = { id: string; name: string; color?: string | null };

export type TimeReportMonthMergedRow = {
  rowKey: string;
  lineId: string;
  lineIdByWeekSliceKey: Record<string, string>;
  displayOrder: number;
  weekSliceKeys: string[];
  isDraft?: boolean;
  customerId: string;
  projectId: string;
  roleId: string;
  jiraDevOpsValue: string;
  task: string;
  hoursByDate: Record<string, number>;
  commentsByDate: Record<string, string>;
};

export function compareCustomerIdsByName(
  a: string,
  b: string,
  customerById: Map<string, TimeReportMonthCustomerOption>
): number {
  const na = customerById.get(a)?.name ?? a;
  const nb = customerById.get(b)?.name ?? b;
  const c = na.localeCompare(nb, "sv", { sensitivity: "base" });
  if (c !== 0) return c;
  return a.localeCompare(b);
}

export function sortCustomerGroupsByCustomerName(
  groups: TimeReportCustomerGroup[],
  customerById: Map<string, TimeReportMonthCustomerOption>
): TimeReportCustomerGroup[] {
  return [...groups].sort((x, y) =>
    compareCustomerIdsByName(x.customerId, y.customerId, customerById)
  );
}

export function sortMonthMergedRowsByCustomerName(
  rows: TimeReportMonthMergedRow[],
  customerById: Map<string, TimeReportMonthCustomerOption>
): TimeReportMonthMergedRow[] {
  return [...rows].sort((a, b) => {
    const c = compareCustomerIdsByName(a.customerId, b.customerId, customerById);
    if (c !== 0) return c;
    return a.rowKey.localeCompare(b.rowKey);
  });
}

export function buildMergedMonthRows(
  slices: Record<string, TimeReportCustomerGroup[]>,
  monthWeeks: { year: number; week: number }[],
  monthCalendarDates: string[],
  customerById: Map<string, TimeReportMonthCustomerOption>
): TimeReportMonthMergedRow[] {
  type Source = {
    mergeKey: string;
    sliceKey: string;
    customerId: string;
    entry: TimeReportEntry;
    hoursByDate: Record<string, number>;
    commentsByDate: Record<string, string>;
  };
  const monthSet = new Set(monthCalendarDates);
  const sources: Source[] = [];

  for (const { year: y, week: w } of monthWeeks) {
    const sk = weekSliceKey(y, w);
    const weekDates = getWeekDates(y, w);
    const groups = slices[sk] ?? [];
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const g = groups[groupIndex]!;
      for (const e of g.entries) {
        let hasInsideMonthActivity = false;
        let hasOutsideMonthActivity = false;
        for (let i = 0; i < 7; i++) {
          const d = weekDates[i]!;
          const h = e.hours[i] ?? 0;
          const cmt = (e.comments[i] ?? "").trim();
          const active = h > 0 || cmt !== "";
          if (!active) continue;
          if (monthSet.has(d)) hasInsideMonthActivity = true;
          else hasOutsideMonthActivity = true;
        }
        if (hasOutsideMonthActivity && !hasInsideMonthActivity) continue;

        const hoursByDate: Record<string, number> = {};
        const commentsByDate: Record<string, string> = {};
        for (let i = 0; i < 7; i++) {
          const d = weekDates[i]!;
          if (!monthSet.has(d)) continue;
          hoursByDate[d] = e.hours[i] ?? 0;
          const c = (e.comments[i] ?? "").trim();
          if (c) commentsByDate[d] = e.comments[i] ?? "";
        }
        const mergeKey = `${g.customerId}|${e.projectId}|${e.roleId}|${e.jiraDevOpsValue ?? ""}|${(e.task ?? "").trim()}|${e.displayOrder ?? 0}`;
        sources.push({
          mergeKey,
          sliceKey: sk,
          customerId: g.customerId,
          entry: e,
          hoursByDate,
          commentsByDate,
        });
      }
    }
  }

  const byKey = new Map<string, Source[]>();
  const keyOrder: string[] = [];
  for (const s of sources) {
    if (!byKey.has(s.mergeKey)) {
      byKey.set(s.mergeKey, []);
      keyOrder.push(s.mergeKey);
    }
    byKey.get(s.mergeKey)!.push(s);
  }

  const rows: TimeReportMonthMergedRow[] = [];
  const mergeKeyRank = new Map<string, number>();
  for (const mk of keyOrder) {
    mergeKeyRank.set(mk, mergeKeyRank.size);
    const list = byKey.get(mk)!;
    const first = list[0]!;
    const lineIdByWeekSliceKey: Record<string, string> = {};
    for (const s of list) {
      const cur = lineIdByWeekSliceKey[s.sliceKey];
      if (!cur || s.entry.id < cur) lineIdByWeekSliceKey[s.sliceKey] = s.entry.id;
    }
    const sliceIds = Object.values(lineIdByWeekSliceKey);
    const canonicalLineId =
      sliceIds.length > 0 ? sliceIds.reduce((a, b) => (a < b ? a : b)) : first.entry.id;
    const hoursByDate: Record<string, number> = {};
    const commentsByDate: Record<string, string> = {};
    for (const d of monthCalendarDates) {
      hoursByDate[d] = 0;
      commentsByDate[d] = "";
    }
    for (const s of list) {
      for (const d of monthCalendarDates) {
        hoursByDate[d] = (hoursByDate[d] ?? 0) + (s.hoursByDate[d] ?? 0);
        const t = (s.commentsByDate[d] ?? "").trim();
        if (t) commentsByDate[d] = t;
      }
    }
    rows.push({
      rowKey: mk,
      lineId: canonicalLineId,
      lineIdByWeekSliceKey,
      displayOrder: first.entry.displayOrder ?? 0,
      weekSliceKeys: [...new Set(list.map((s) => s.sliceKey))],
      customerId: first.customerId,
      projectId: first.entry.projectId,
      roleId: first.entry.roleId,
      jiraDevOpsValue: first.entry.jiraDevOpsValue,
      task: first.entry.task ?? "",
      hoursByDate,
      commentsByDate,
    });
  }
  rows.sort((a, b) => {
    const rc = compareCustomerIdsByName(a.customerId, b.customerId, customerById);
    if (rc !== 0) return rc;
    const ka = mergeKeyRank.get(a.rowKey) ?? Number.MAX_SAFE_INTEGER;
    const kb = mergeKeyRank.get(b.rowKey) ?? Number.MAX_SAFE_INTEGER;
    return ka - kb;
  });
  return rows;
}
