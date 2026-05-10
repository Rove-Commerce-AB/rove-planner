import { describe, expect, it } from "vitest";

import { getWeekDates, weekSliceKey } from "@/lib/timeReportBrowserWeek";
import type { TimeReportCustomerGroup, TimeReportEntry } from "@/types";

import { buildMergedMonthRows } from "./timeReportMonthMerge";

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
  activeYmd: string
): TimeReportEntry {
  return {
    id,
    displayOrder,
    projectId: "proj-1",
    roleId: "role-1",
    jiraDevOpsValue: "",
    task: "Same task",
    hours: hoursForWeek(weekDates, activeYmd, 4),
    comments: {},
  };
}

describe("buildMergedMonthRows", () => {
  const customerById = new Map([["cust-a", { id: "cust-a", name: "Acme" }]]);

  it("merges two ISO-week slices into one row when business key and displayOrder match", () => {
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
      entries: [baseEntry("line-a", sharedOrder, wdA, wdA[0]!)],
    };
    const groupB: TimeReportCustomerGroup = {
      customerId: "cust-a",
      entries: [baseEntry("line-b", sharedOrder, wdB, wdB[0]!)],
    };

    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, wA)]: [groupA],
      [weekSliceKey(y, wB)]: [groupB],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.weekSliceKeys.sort()).toEqual(
      [weekSliceKey(y, wA), weekSliceKey(y, wB)].sort()
    );
  });

  it("keeps separate merged rows when displayOrder differs across weeks (split merge key)", () => {
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
      entries: [baseEntry("line-a", 1000, wdA, wdA[0]!)],
    };
    const groupB: TimeReportCustomerGroup = {
      customerId: "cust-a",
      entries: [baseEntry("line-b", 3000, wdB, wdB[0]!)],
    };

    const slices: Record<string, TimeReportCustomerGroup[]> = {
      [weekSliceKey(y, wA)]: [groupA],
      [weekSliceKey(y, wB)]: [groupB],
    };

    const rows = buildMergedMonthRows(slices, monthWeeks, monthCalendarDates, customerById);
    expect(rows).toHaveLength(2);
  });
});
