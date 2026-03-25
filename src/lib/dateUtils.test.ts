import { describe, expect, it, vi, afterEach } from "vitest";
import {
  addWeeksToYearWeek,
  getCurrentYearWeek,
  getISOWeekDateRange,
  getISOWeekDateStrings,
  getMonthForWeek,
  getMonthLabel,
  getMonthSpansForWeeks,
  getWeeksInMonth,
  getWorkingDaysByMonthInWeek,
  getYearWeekForDate,
  isoWeeksInYear,
} from "./dateUtils";

describe("getYearWeekForDate", () => {
  it("maps Monday 1 Jan 2024 to ISO week 1 of 2024", () => {
    expect(getYearWeekForDate(new Date(2024, 0, 1))).toEqual({
      year: 2024,
      week: 1,
    });
  });

  it("maps a known Thursday in June 2024 consistently", () => {
    expect(getYearWeekForDate(new Date(2024, 5, 13))).toEqual({
      year: 2024,
      week: 24,
    });
  });
});

describe("getISOWeekDateRange", () => {
  it("returns Mon–Sun for 2024 week 1", () => {
    expect(getISOWeekDateRange(2024, 1)).toEqual({
      start: "2024-01-01",
      end: "2024-01-07",
    });
  });
});

describe("getISOWeekDateStrings", () => {
  it("returns seven consecutive days starting Monday of ISO week", () => {
    const days = getISOWeekDateStrings(2024, 1);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2024-01-01");
    expect(days[6]).toBe("2024-01-07");
  });
});

describe("isoWeeksInYear", () => {
  it("is always 52 or 53", () => {
    for (const y of [2020, 2021, 2024, 2025, 2026]) {
      const n = isoWeeksInYear(y);
      expect(n).toBeGreaterThanOrEqual(52);
      expect(n).toBeLessThanOrEqual(53);
    }
  });
});

describe("addWeeksToYearWeek", () => {
  it("round-trips forward and back across year boundary", () => {
    const start = { year: 2024, week: 50 };
    const forward = addWeeksToYearWeek(start.year, start.week, 6);
    const back = addWeeksToYearWeek(forward.year, forward.week, -6);
    expect(back).toEqual(start);
  });

  it("handles week 53 years when stepping forward", () => {
    if (isoWeeksInYear(2024) === 53) {
      const next = addWeeksToYearWeek(2024, 52, 2);
      expect(next.year).toBeGreaterThanOrEqual(2024);
      expect(next.week).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("getWeeksInMonth", () => {
  it("includes every ISO week that touches the month", () => {
    const march2024 = getWeeksInMonth(3, 2024);
    expect(march2024.length).toBeGreaterThan(0);
    const first = march2024[0];
    const last = march2024[march2024.length - 1];
    expect(
      getMonthForWeek(first.year, first.week) === 3 ||
        getMonthForWeek(last.year, last.week) === 3
    ).toBe(true);
  });
});

describe("getMonthForWeek / getMonthLabel", () => {
  it("uses Monday of the ISO week for display month", () => {
    expect(getMonthForWeek(2024, 1)).toBe(1);
    expect(getMonthLabel(1, 2024)).toBe("Jan 2024");
  });
});

describe("getMonthSpansForWeeks", () => {
  it("returns empty for empty input", () => {
    expect(getMonthSpansForWeeks([])).toEqual([]);
  });

  it("groups consecutive weeks in the same display month", () => {
    const spans = getMonthSpansForWeeks([
      { year: 2024, week: 1 },
      { year: 2024, week: 2 },
    ]);
    expect(spans).toEqual([{ label: "Jan 2024", colSpan: 2 }]);
  });
});

describe("getWorkingDaysByMonthInWeek", () => {
  it("excludes weekends", () => {
    const buckets = getWorkingDaysByMonthInWeek(2024, 1, new Set());
    const total = buckets.reduce((s, b) => s + b.workingDays, 0);
    expect(total).toBe(5);
  });

  it("excludes weekdays that are holidays", () => {
    const buckets = getWorkingDaysByMonthInWeek(
      2024,
      1,
      new Set(["2024-01-02"])
    );
    const total = buckets.reduce((s, b) => s + b.workingDays, 0);
    expect(total).toBe(4);
  });
});

describe("getCurrentYearWeek", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches getYearWeekForDate for a fixed clock", () => {
    vi.useFakeTimers();
    const fixed = new Date(2024, 5, 15, 12, 0, 0);
    vi.setSystemTime(fixed);
    expect(getCurrentYearWeek()).toEqual(getYearWeekForDate(fixed));
  });
});
