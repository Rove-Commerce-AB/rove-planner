import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");

describe("time report today column highlight", () => {
  const css = readFileSync(path.join(repoRoot, "src/app/globals.css"), "utf8");
  const client = readFileSync(
    path.join(repoRoot, "src/app/(app)/time-report/TimeReportPageClient.tsx"),
    "utf8"
  );

  it("uses dedicated classes that beat sticky header background", () => {
    expect(css).toContain(".time-report-tables thead th.time-report-today-header");
    expect(css).toContain(".time-report-tables tbody td.time-report-today-cell");
    expect(client).toContain('todayHeaderClass = "time-report-today-header"');
    expect(client).toContain('todayColumnClass = "time-report-today-cell"');
    expect(client).toContain('isToday ? "time-report-today-cell"');
  });

  it("tints today with saturated interactive-primary, not near-white brand-blue", () => {
    const headerStart = css.indexOf(
      ".time-report-tables thead th.time-report-today-header"
    );
    const cellStart = css.indexOf(
      ".time-report-tables tbody td.time-report-today-cell"
    );
    expect(headerStart).toBeGreaterThan(-1);
    expect(cellStart).toBeGreaterThan(headerStart);
    const todayCss = css.slice(headerStart, cellStart + 280);
    expect(todayCss).toContain("var(--color-interactive-primary)");
    expect(todayCss).not.toContain("var(--color-brand-blue)");
    expect(client).not.toContain("bg-brand-blue/15");
    expect(client).not.toContain("bg-brand-blue/32");
  });
});
