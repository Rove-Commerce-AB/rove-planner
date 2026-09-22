import { describe, expect, it } from "vitest";
import {
  allocationRangeIncludesWeek,
  allocationWeekSpan,
  allocationWindowAroundWeek,
  buildWeeksArray,
} from "./allocationWeekParams";

describe("buildWeeksArray", () => {
  it("builds contiguous weeks in one year", () => {
    const weeks = buildWeeksArray(2026, 19, 24);
    expect(weeks).toHaveLength(6);
    expect(weeks[0]).toEqual({ year: 2026, week: 19 });
    expect(weeks[5]).toEqual({ year: 2026, week: 24 });
  });

  it("supports long spans without clipping", () => {
    const weeks = buildWeeksArray(2024, 19, 71);
    expect(weeks).toHaveLength(53);
    expect(weeks[0]).toEqual({ year: 2024, week: 19 });
    expect(weeks[52]).toEqual({ year: 2024, week: 71 });
  });
});

describe("allocation current-week window", () => {
  it("counts a year-wrapping range", () => {
    expect(allocationWeekSpan(2026, 50, 3)).toBe(
      buildWeeksArray(2026, 50, 3).length
    );
    expect(allocationWeekSpan(2026, 50, 3)).toBeGreaterThan(3);
  });

  it("includes the current week on either side of the year boundary", () => {
    const range = { year: 2026, weekFrom: 50, weekTo: 3 };
    expect(
      allocationRangeIncludesWeek(range, { year: 2026, week: 52 })
    ).toBe(true);
    expect(
      allocationRangeIncludesWeek(range, { year: 2027, week: 1 })
    ).toBe(true);
    expect(
      allocationRangeIncludesWeek(range, { year: 2026, week: 39 })
    ).toBe(false);
  });

  it("anchors a window with the current week two columns from the left", () => {
    expect(allocationWindowAroundWeek(2026, 39, 8)).toEqual({
      year: 2026,
      weekFrom: 37,
      weekTo: 44,
    });
    const aroundNewYear = allocationWindowAroundWeek(2027, 2, 5);
    expect(
      allocationRangeIncludesWeek(aroundNewYear, { year: 2027, week: 2 })
    ).toBe(true);
    expect(allocationWeekSpan(
      aroundNewYear.year,
      aroundNewYear.weekFrom,
      aroundNewYear.weekTo
    )).toBe(5);
    expect(buildWeeksArray(
      aroundNewYear.year,
      aroundNewYear.weekFrom,
      aroundNewYear.weekTo
    )[2]).toEqual({ year: 2027, week: 2 });
  });
});
