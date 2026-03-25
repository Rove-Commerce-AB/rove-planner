import { describe, expect, it } from "vitest";
import { isInlineEditValueChanged } from "./inlineEdit";

describe("isInlineEditValueChanged", () => {
  it("returns false when trimmed values match (default)", () => {
    expect(isInlineEditValueChanged("  hello  ", "hello")).toBe(false);
  });

  it("returns true when trimmed content differs", () => {
    expect(isInlineEditValueChanged("a", "b")).toBe(true);
  });

  it("respects trim: false when whitespace is meaningful", () => {
    expect(isInlineEditValueChanged(" x", "x", { trim: false })).toBe(true);
    expect(isInlineEditValueChanged(" x", " x", { trim: false })).toBe(false);
  });
});
