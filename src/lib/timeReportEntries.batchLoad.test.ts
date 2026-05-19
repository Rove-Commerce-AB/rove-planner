import { describe, expect, it, vi } from "vitest";
import { loadTimeReportEntriesForWeeksSequential } from "./timeReportEntriesBatchLoad";

describe("loadTimeReportEntriesForWeeksSequential", () => {
  it("calls the loader once per week in order with the same month filter", async () => {
    const week10 = { groups: [], revision: 1 };
    const week11 = { groups: [{ customerId: "c1", entries: [] }], revision: 2 };
    const loadWeek = vi
      .fn()
      .mockResolvedValueOnce(week10)
      .mockResolvedValueOnce(week11);

    const weeks = [
      { year: 2026, week: 10 },
      { year: 2026, week: 11 },
    ];
    const batch = await loadTimeReportEntriesForWeeksSequential(
      loadWeek,
      "consultant-1",
      weeks,
      { year: 2026, month: 5 }
    );

    expect(loadWeek).toHaveBeenCalledTimes(2);
    expect(loadWeek).toHaveBeenNthCalledWith(1, "consultant-1", 2026, 10, {
      year: 2026,
      month: 5,
    });
    expect(loadWeek).toHaveBeenNthCalledWith(2, "consultant-1", 2026, 11, {
      year: 2026,
      month: 5,
    });
    expect(batch).toEqual([week10, week11]);
  });
});
