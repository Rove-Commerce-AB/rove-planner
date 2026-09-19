import { describe, expect, it } from "vitest";
import { formatTimeAgo, formatWorkTimestamp } from "./workTimeAgo";

describe("formatWorkTimestamp", () => {
  it("formats local time as yy-mm-dd HH:mm", () => {
    const date = new Date(2026, 8, 19, 9, 5);
    expect(formatWorkTimestamp(date.toISOString())).toBe("26-09-19 09:05");
  });
});

describe("formatTimeAgo", () => {
  const now = Date.parse("2026-09-13T12:00:00.000Z");

  it("uses hour and day buckets", () => {
    expect(formatTimeAgo("2026-09-13T10:00:00.000Z", now)).toBe("2 hours ago");
    expect(formatTimeAgo("2026-09-12T12:00:00.000Z", now)).toBe("1 day ago");
  });
});
