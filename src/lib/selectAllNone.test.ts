import { describe, expect, it } from "vitest";
import { assignmentSelectionState } from "./selectAllNone";

describe("assignmentSelectionState", () => {
  const ids = ["a", "b", "c"];

  it("treats a full selection as all selected", () => {
    expect(assignmentSelectionState(ids, ["a", "b", "c"])).toEqual({
      allSelected: true,
      noneSelected: false,
    });
  });

  it("treats an empty selection as none selected", () => {
    expect(assignmentSelectionState(ids, [])).toEqual({
      allSelected: false,
      noneSelected: true,
    });
  });

  it("treats a partial selection as neither", () => {
    expect(assignmentSelectionState(ids, ["b"])).toEqual({
      allSelected: false,
      noneSelected: false,
    });
  });

  it("ignores selected ids that are not in the visible list", () => {
    expect(assignmentSelectionState(ids, ["z"])).toEqual({
      allSelected: false,
      noneSelected: true,
    });
  });
});
