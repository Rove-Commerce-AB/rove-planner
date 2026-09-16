import { describe, expect, it } from "vitest";

import { getWeekDates, weekSliceKey } from "@/lib/timeReportBrowserWeek";
import type { TimeReportCustomerGroup, TimeReportEntry } from "@/types";

import {
  buildCustomerGroupsForWeekFromMerged,
  buildMergedMonthRows,
  monthRowBelongsToSaveWeek,
  weekSliceKeysForMergedRow,
} from "./timeReportMonthMerge";

function sortedUniqueDates(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

function hoursForWeek(weekDates: string[], ymd: string, hours: number): number[] {
  return weekDates.map((d) => (d === ymd ? hours : 0));
}

function baseEntry(
  id: string,
  displayOrder: number,
  weekDates: string[],
  activeYmd: string,
  hours = 4
): TimeReportEntry {
  return {
    id,
    displayOrder,
    projectId: "proj-1",
    roleId: "role-1",
    jiraDevOpsValue: "",
    task: "Same task",
    hours: hoursForWeek(weekDates, activeYmd, hours),
    comments: {},
  };
}

describe("buildMergedMonthRows", () => {
  const customerById = new Map([["cust-a", { id: "cust-a", name: "Acme" }]]);

  it("merges two ISO-week slices into one row when the same line id is reused", () => {
    const y = 2026;
    const wA = 5;
    const wB = 6;
    const wdA = getWeekDates(y, wA);
    const wdB = getWeekDates(y, wB);
    const monthCalendarDates = sortedUniqueDates([...wdA, ...wdB]);
    const monthWeeks = [
      { year: y, week: wA },
      { year: y, week: wB },
    ];

    const sharedOrder = 42;
    const groupA: TimeReportCustomerGroup = {
      customerId: "cust-a",
      entries: [baseEntry("line-shared", sharedOrder, wdA, wdA[0]!)],
    };
    const groupB: TimeReportCustomerGroup = {
      customerId: "cust-a",
      entries: [baseEntry("line-shared", sharedOrder, wdB, wdB[0]!)],
    };

    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, wA)]: [groupA],
      [weekSliceKey(y, wB)]: [groupB],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.lineId).toBe("line-shared");
    expect(rows[0]!.hoursByDate[wdA[0]!]).toBe(4);
    expect(rows[0]!.hoursByDate[wdB[0]!]).toBe(4);
    expect(rows[0]!.weekSliceKeys.sort()).toEqual(
      [weekSliceKey(y, wA), weekSliceKey(y, wB)].sort()
    );
  });

  it("merges across ISO-week slices for the same line id when only displayOrder differs", () => {
    const y = 2026;
    const wA = 5;
    const wB = 6;
    const wdA = getWeekDates(y, wA);
    const wdB = getWeekDates(y, wB);
    const monthCalendarDates = sortedUniqueDates([...wdA, ...wdB]);
    const monthWeeks = [
      { year: y, week: wA },
      { year: y, week: wB },
    ];

    const groupA: TimeReportCustomerGroup = {
      customerId: "cust-a",
      entries: [baseEntry("line-shared", 1000, wdA, wdA[0]!)],
    };
    const groupB: TimeReportCustomerGroup = {
      customerId: "cust-a",
      entries: [baseEntry("line-shared", 3000, wdB, wdB[0]!)],
    };

    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, wA)]: [groupA],
      [weekSliceKey(y, wB)]: [groupB],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.displayOrder).toBe(1000);
    expect(rows[0]!.weekSliceKeys.sort()).toEqual(
      [weekSliceKey(y, wA), weekSliceKey(y, wB)].sort()
    );
  });

  it("does not merge distinct line ids in the same week even when project/jira/task match", () => {
    const y = 2026;
    const w = 38;
    const wd = getWeekDates(y, w);
    const monday = wd[0]!;
    const monthCalendarDates = wd;
    const monthWeeks = [{ year: y, week: w }];

    const keeper = baseEntry("line-a", 1027, wd, monday, 12);
    const loser = baseEntry("line-b", 1027, wd, monday, 1.5);
    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, w)]: [{ customerId: "cust-a", entries: [keeper, loser] }],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(2);
    const hoursOnMonday = rows.map((r) => r.hoursByDate[monday] ?? 0).sort((a, b) => a - b);
    expect(hoursOnMonday).toEqual([1.5, 12]);
    expect(rows.some((r) => (r.hoursByDate[monday] ?? 0) === 13.5)).toBe(false);
  });

  it("does not merge distinct line ids across weeks that only share shape", () => {
    const y = 2026;
    const wA = 5;
    const wB = 6;
    const wdA = getWeekDates(y, wA);
    const wdB = getWeekDates(y, wB);
    const monthCalendarDates = sortedUniqueDates([...wdA, ...wdB]);
    const monthWeeks = [
      { year: y, week: wA },
      { year: y, week: wB },
    ];

    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, wA)]: [
        { customerId: "cust-a", entries: [baseEntry("line-a", 42, wdA, wdA[0]!)] },
      ],
      [weekSliceKey(y, wB)]: [
        { customerId: "cust-a", entries: [baseEntry("line-b", 42, wdB, wdB[0]!)] },
      ],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.lineId).sort()).toEqual(["line-a", "line-b"]);
  });

  it("does not merge rows when source prefixes differ", () => {
    const y = 2026;
    const wA = 5;
    const wB = 6;
    const wdA = getWeekDates(y, wA);
    const wdB = getWeekDates(y, wB);
    const monthCalendarDates = sortedUniqueDates([...wdA, ...wdB]);
    const monthWeeks = [
      { year: y, week: wA },
      { year: y, week: wB },
    ];

    const jiraEntry = {
      ...baseEntry("line-a", 1000, wdA, wdA[0]!),
      jiraDevOpsValue: "jira:ABC-1",
    };
    const clickupEntry = {
      ...baseEntry("line-b", 1000, wdB, wdB[0]!),
      jiraDevOpsValue: "clickup:ABC-1",
    };

    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, wA)]: [{ customerId: "cust-a", entries: [jiraEntry] }],
      [weekSliceKey(y, wB)]: [{ customerId: "cust-a", entries: [clickupEntry] }],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(2);
  });

  it("keeps hours outside the calendar month off the merged row (ISO week spill)", () => {
    const y = 2026;
    const w = 40;
    const wd = getWeekDates(y, w);
    expect(wd[0]!.startsWith("2026-09-")).toBe(true);
    expect(wd[wd.length - 1]!.startsWith("2026-10-")).toBe(true);
    const septemberDates = wd.filter((d) => d.startsWith("2026-09-"));
    const octoberDates = wd.filter((d) => d.startsWith("2026-10-"));
    const hours = wd.map((d) => (octoberDates.includes(d) ? 8 : septemberDates.includes(d) ? 3 : 0));
    const entry: TimeReportEntry = {
      id: "line-shared",
      displayOrder: 1,
      projectId: "proj-1",
      roleId: "role-1",
      jiraDevOpsValue: "",
      task: "",
      hours,
      comments: {},
    };
    const slices = {
      [weekSliceKey(y, w)]: [{ customerId: "cust-a", entries: [entry] }],
    };
    const rows = buildMergedMonthRows(
      slices,
      [{ year: y, week: w }],
      septemberDates,
      customerById
    );
    expect(rows).toHaveLength(1);
    for (const d of septemberDates) {
      expect(rows[0]!.hoursByDate[d]).toBe(3);
    }
    for (const d of octoberDates) {
      expect(rows[0]!.hoursByDate[d]).toBeUndefined();
    }
  });
});

describe("buildCustomerGroupsForWeekFromMerged", () => {
  const customerById = new Map([["cust-a", { id: "cust-a", name: "Acme" }]]);

  it("emits both line ids and does not sum same-day hours", () => {
    const y = 2026;
    const w = 38;
    const wd = getWeekDates(y, w);
    const monday = wd[0]!;
    const monthWeeks = [{ year: y, week: w }];
    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, w)]: [
        {
          customerId: "cust-a",
          entries: [
            baseEntry("line-a", 1, wd, monday, 12),
            baseEntry("line-b", 2, wd, monday, 1.5),
          ],
        },
      ],
    };
    const rows = buildMergedMonthRows(slices, monthWeeks, wd, customerById);
    const groups = buildCustomerGroupsForWeekFromMerged(rows, y, w);
    expect(groups).toHaveLength(1);
    const ids = groups[0]!.entries.map((e) => e.id).sort();
    expect(ids).toEqual(["line-a", "line-b"]);
    const mondayHours = groups[0]!.entries.map((e) => e.hours[0] ?? 0).sort((a, b) => a - b);
    expect(mondayHours).toEqual([1.5, 12]);
  });

  it("does not include a draft row in weeks without hours or comments", () => {
    const y = 2026;
    const w = 38;
    const wd = getWeekDates(y, w);
    const hoursByDate: Record<string, number> = {};
    const commentsByDate: Record<string, string> = {};
    for (const d of wd) {
      hoursByDate[d] = 0;
      commentsByDate[d] = "";
    }
    const draft = {
      rowKey: "draft",
      lineId: "new-line",
      lineIdByWeekSliceKey: {},
      displayOrder: 0,
      weekSliceKeys: [],
      isDraft: true,
      customerId: "cust-a",
      projectId: "proj-1",
      roleId: "role-1",
      jiraDevOpsValue: "",
      task: "",
      hoursByDate,
      commentsByDate,
    };
    expect(monthRowBelongsToSaveWeek(draft, y, w)).toBe(false);
    expect(weekSliceKeysForMergedRow(draft, [{ year: y, week: w }])).toEqual([]);
    const groups = buildCustomerGroupsForWeekFromMerged([draft], y, w);
    expect(groups).toEqual([]);
  });

  it("includes a draft once it has hours in that week", () => {
    const y = 2026;
    const w = 38;
    const wd = getWeekDates(y, w);
    const hoursByDate: Record<string, number> = {};
    const commentsByDate: Record<string, string> = {};
    for (const d of wd) {
      hoursByDate[d] = 0;
      commentsByDate[d] = "";
    }
    hoursByDate[wd[0]!] = 2;
    const draft = {
      rowKey: "draft",
      lineId: "new-line",
      lineIdByWeekSliceKey: {},
      displayOrder: 0,
      weekSliceKeys: [],
      isDraft: true,
      customerId: "cust-a",
      projectId: "proj-1",
      roleId: "role-1",
      jiraDevOpsValue: "",
      task: "",
      hoursByDate,
      commentsByDate,
    };
    expect(monthRowBelongsToSaveWeek(draft, y, w)).toBe(true);
    const groups = buildCustomerGroupsForWeekFromMerged([draft], y, w);
    expect(groups[0]!.entries).toHaveLength(1);
    expect(groups[0]!.entries[0]!.id).toBe("new-line");
    expect(groups[0]!.entries[0]!.hours[0]).toBe(2);
  });
});
