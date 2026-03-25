import { describe, expect, it } from "vitest";
import {
  formatAllocationWeekLabel,
  getAllocationCellBgClass,
} from "./allocationPageDisplay";

describe("formatAllocationWeekLabel", () => {
  it("uses W{week} {year} format", () => {
    expect(formatAllocationWeekLabel(12, 2025)).toBe("W12 2025");
  });
});

describe("getAllocationCellBgClass", () => {
  it("returns a class for boundary percentages", () => {
    expect(getAllocationCellBgClass(0)).toBe("bg-bg-muted/20");
    expect(getAllocationCellBgClass(49)).toBe("bg-danger/18");
    expect(getAllocationCellBgClass(50)).toBe("bg-danger/10");
    expect(getAllocationCellBgClass(74)).toBe("bg-danger/10");
    expect(getAllocationCellBgClass(75)).toBe("bg-success/10");
    expect(getAllocationCellBgClass(94)).toBe("bg-success/10");
    expect(getAllocationCellBgClass(95)).toBe("bg-success/20");
    expect(getAllocationCellBgClass(105)).toBe("bg-success/20");
    expect(getAllocationCellBgClass(106)).toBe("bg-brand-blue/14");
    expect(getAllocationCellBgClass(120)).toBe("bg-brand-blue/14");
    expect(getAllocationCellBgClass(121)).toBe("bg-brand-blue/25");
  });
});
