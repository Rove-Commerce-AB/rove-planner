import { describe, expect, it } from "vitest";
import { buildWeeksArray } from "./allocationWeekParams";

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
