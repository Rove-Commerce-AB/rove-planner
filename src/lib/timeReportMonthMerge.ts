/**
 * Month-view merge of ISO-week time report slices.
 * A merged row groups week payloads that describe the same physical line UUID.
 *
 * Merge identity (month grid): customerId + projectId + roleId + jira key + trimmed task + line id.
 * The same `time_report_entry_lines.id` is reused across ISO weeks (PK includes year/week), so one
 * logical row still spans the calendar month. Distinct UUIDs with the same project/Jira/task stay
 * separate — summing those was inflating hours on autosave/reload.
 *
 * displayOrder is deliberately omitted from the key: it can differ per ISO week for the same id.
 * The merged row's displayOrder is the minimum among contributing slices for stable sorting.
 * Month-to-next-month copy should still align displayOrder across weeks when possible
 * (see copyEntryToWeek lineDisplayOrder).
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

/** Stable month-grid identity: shape + physical line UUID (reused across ISO weeks). */
export function monthLineMergeKey(
  customerId: string,
  entry: Pick<TimeReportEntry, "id" | "projectId" | "roleId" | "jiraDevOpsValue" | "task">
): string {
  return [
    customerId,
    entry.projectId ?? "",
    entry.roleId ?? "",
    entry.jiraDevOpsValue ?? "",
    (entry.task ?? "").trim(),
    entry.id,
  ].join("|");
}

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
        const mergeKey = monthLineMergeKey(g.customerId, e);
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
    const definedOrders = list
      .map((s) => s.entry.displayOrder)
      .filter((o): o is number => typeof o === "number" && Number.isFinite(o));
    const mergedDisplayOrder =
      definedOrders.length > 0 ? Math.min(...definedOrders) : (first.entry.displayOrder ?? 0);
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
      displayOrder: Number.isFinite(mergedDisplayOrder) ? mergedDisplayOrder : 0,
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

  /* Weeks where the row shows hours/comments inside the calendar month but had no slice-specific
   * line id (e.g. spill-over from merged slices). Without this, save rebuild falls back to shared
   * row.lineId across rows → ambiguous line identity. */
  for (const row of rows) {
    for (const mw of monthWeeks) {
      const sk = weekSliceKey(mw.year, mw.week);
      if (row.lineIdByWeekSliceKey[sk]) continue;
      const wd = getWeekDates(mw.year, mw.week);
      const activeInMonth = wd.some(
        (d) =>
          monthSet.has(d) &&
          ((row.hoursByDate[d] ?? 0) > 0 || (row.commentsByDate[d] ?? "").trim() !== "")
      );
      if (!activeInMonth) continue;
      const sortedSliceIds = [...new Set(Object.values(row.lineIdByWeekSliceKey))].sort();
      row.lineIdByWeekSliceKey[sk] = sortedSliceIds[0] ?? row.lineId;
    }
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

export function resolveMergedRowLineIdForWeek(
  row: TimeReportMonthMergedRow,
  sliceKeyStr: string
): string {
  const direct = row.lineIdByWeekSliceKey[sliceKeyStr];
  if (direct) return direct;
  const pool = [...new Set(Object.values(row.lineIdByWeekSliceKey))].sort();
  return pool[0] ?? row.lineId;
}

export function weekSliceKeysForMergedRow(
  row: TimeReportMonthMergedRow,
  monthWeeks: { year: number; week: number }[]
): string[] {
  const keys = new Set<string>(row.weekSliceKeys);
  for (const { year, week } of monthWeeks) {
    const sk = weekSliceKey(year, week);
    const active = getWeekDates(year, week).some(
      (d) =>
        (row.hoursByDate[d] ?? 0) > 0 || (row.commentsByDate[d] ?? "").trim() !== ""
    );
    if (active) keys.add(sk);
  }
  return [...keys];
}

export function monthRowBelongsToSaveWeek(
  row: TimeReportMonthMergedRow,
  y: number,
  w: number
): boolean {
  const sk = weekSliceKey(y, w);
  const weekDates = getWeekDates(y, w);
  const hasWeekData = weekDates.some(
    (d) => (row.hoursByDate[d] ?? 0) > 0 || (row.commentsByDate[d] ?? "").trim() !== ""
  );
  return hasWeekData || row.weekSliceKeys.includes(sk);
}

/** Rebuild one ISO-week save payload from month-grid rows. Drafts without hours are omitted. */
export function buildCustomerGroupsForWeekFromMerged(
  rows: TimeReportMonthMergedRow[],
  y: number,
  w: number
): TimeReportCustomerGroup[] {
  const sk = weekSliceKey(y, w);
  const weekDates = getWeekDates(y, w);
  const order: string[] = [];
  const byCustomer = new Map<string, TimeReportEntry[]>();
  for (const row of rows) {
    if (!monthRowBelongsToSaveWeek(row, y, w)) continue;
    if (!byCustomer.has(row.customerId)) {
      byCustomer.set(row.customerId, []);
      order.push(row.customerId);
    }
    const hours = weekDates.map((d) => row.hoursByDate[d] ?? 0);
    const comments: Record<number, string> = {};
    weekDates.forEach((d, i) => {
      const t = (row.commentsByDate[d] ?? "").trim();
      if (t) comments[i] = row.commentsByDate[d] ?? "";
    });
    const lineIdForWeek = resolveMergedRowLineIdForWeek(row, sk);
    byCustomer.get(row.customerId)!.push({
      id: lineIdForWeek,
      displayOrder: row.displayOrder,
      projectId: row.projectId,
      roleId: row.roleId,
      jiraDevOpsValue: row.jiraDevOpsValue,
      task: row.task,
      hours,
      comments,
    });
  }
  return order.map((cid) => ({ customerId: cid, entries: byCustomer.get(cid)! }));
}
