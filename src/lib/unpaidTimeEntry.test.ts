import { describe, expect, it } from "vitest";

import {
  billableReportedHours,
  isUnpaidTimeEntry,
  textMarksUnpaid,
  unpaidTimeEntrySql,
} from "./unpaidTimeEntry";

describe("textMarksUnpaid", () => {
  it("matches (unpaid) with optional spaces and any case", () => {
    expect(textMarksUnpaid("(unpaid)")).toBe(true);
    expect(textMarksUnpaid("( UNPAID )")).toBe(true);
    expect(textMarksUnpaid("Workshop (unpaid)")).toBe(true);
  });

  it("does not match unpaid without the parentheses marker", () => {
    expect(textMarksUnpaid("unpaid overtime")).toBe(false);
    expect(textMarksUnpaid("(unpaid")).toBe(false);
    expect(textMarksUnpaid(null)).toBe(false);
    expect(textMarksUnpaid("")).toBe(false);
  });
});

describe("isUnpaidTimeEntry", () => {
  it("treats either the description or the internal comment as unpaid", () => {
    expect(isUnpaidTimeEntry("Standup", "prep (unpaid)")).toBe(true);
    expect(isUnpaidTimeEntry("Internal (unpaid)", null)).toBe(true);
    expect(isUnpaidTimeEntry("Feature work", "shipped")).toBe(false);
  });
});

describe("billableReportedHours", () => {
  it("drops unpaid hours from the counted total", () => {
    expect(billableReportedHours(3.5, "Internal (unpaid)", null)).toBe(0);
    expect(billableReportedHours(2, "Feature", "shadowing (unpaid)")).toBe(0);
  });

  it("keeps billable hours", () => {
    expect(billableReportedHours(3.5, "Feature work", null)).toBe(3.5);
  });

  it("ignores empty or invalid hours", () => {
    expect(billableReportedHours(0, "Feature", null)).toBe(0);
    expect(billableReportedHours(Number.NaN, "Feature", null)).toBe(0);
  });
});

describe("unpaidTimeEntrySql", () => {
  it("qualifies both text columns when an alias is given", () => {
    const sql = unpaidTimeEntrySql("t");
    expect(sql).toContain("t.description");
    expect(sql).toContain("t.internal_comment");
    expect(sql).toContain("unpaid");
  });

  it("rejects aliases that are not identifiers", () => {
    expect(() => unpaidTimeEntrySql("t; drop")).toThrow(/alias/i);
  });
});
