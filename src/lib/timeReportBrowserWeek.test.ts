import { describe, expect, it } from "vitest";
import {
  addWeeksToYearWeekLocal,
  getISOWeekDateRangeLocal,
  getWeekDates,
  getWeeksInMonthLocal,
  getYearWeekForDateLocal,
  isoWeeksInYearLocal,
} from "./timeReportBrowserWeek";
import {
  addWeeksToYearWeek,
  getISOWeekDateRange,
  getISOWeekDateStrings,
  getWeeksInMonth,
  getYearWeekForDate,
  isoWeeksInYear,
} from "./dateUtils";

describe("timeReportBrowserWeek parity with dateUtils", () => {
  it("getISOWeekDateRangeLocal matches getISOWeekDateRange for sample years", () => {
    for (const [y, w] of [
      [2024, 1],
      [2024, 52],
      [2025, 10],
    ] as const) {
      expect(getISOWeekDateRangeLocal(y, w)).toEqual(getISOWeekDateRange(y, w));
    }
  });

  it("getYearWeekForDateLocal matches getYearWeekForDate", () => {
    const d = new Date(2024, 2, 15);
    expect(getYearWeekForDateLocal(d)).toEqual(getYearWeekForDate(d));
  });

  it("isoWeeksInYearLocal matches isoWeeksInYear", () => {
    for (const y of [2019, 2024, 2026]) {
      expect(isoWeeksInYearLocal(y)).toBe(isoWeeksInYear(y));
    }
  });

  it("addWeeksToYearWeekLocal matches addWeeksToYearWeek", () => {
    expect(addWeeksToYearWeekLocal(2024, 5, 11)).toEqual(
      addWeeksToYearWeek(2024, 5, 11)
    );
  });

  it("getWeeksInMonthLocal matches getWeeksInMonth", () => {
    expect(getWeeksInMonthLocal(11, 2025)).toEqual(getWeeksInMonth(11, 2025));
  });

  it("getWeekDates returns Mon..Sun like dateUtils week strings", () => {
    expect(getWeekDates(2024, 33)).toEqual(getISOWeekDateStrings(2024, 33));
  });
});
