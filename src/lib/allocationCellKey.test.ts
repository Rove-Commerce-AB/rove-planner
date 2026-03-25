import { describe, expect, it } from "vitest";
import { allocationCellKey } from "./allocationCellKey";

describe("allocationCellKey", () => {
  it("joins parts with pipe and empty string for null role", () => {
    expect(allocationCellKey("c1", "p1", null, 2024, 3)).toBe(
      "c1|p1||2024|3"
    );
  });

  it("includes role id when present", () => {
    expect(allocationCellKey("c1", "p1", "r1", 2025, 1)).toBe(
      "c1|p1|r1|2025|1"
    );
  });
});
