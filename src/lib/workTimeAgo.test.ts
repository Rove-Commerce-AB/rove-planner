import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./workTimeAgo";

describe("formatTimeAgo", () => {
  const now = Date.parse("2026-09-13T12:00:00.000Z");

  it("uses hour and day buckets", () => {
    expect(formatTimeAgo("2026-09-13T10:00:00.000Z", now)).toBe("2 hours ago");
    expect(formatTimeAgo("2026-09-12T12:00:00.000Z", now)).toBe("1 day ago");
  });
});
