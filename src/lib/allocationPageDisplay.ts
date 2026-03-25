export function formatAllocationWeekLabel(week: number, year: number) {
  return `W${week} ${year}`;
}

export function getAllocationCellBgClass(pct: number): string {
  if (pct === 0) return "bg-bg-muted/20";
  if (pct < 50) return "bg-danger/18";
  if (pct < 75) return "bg-danger/10";
  if (pct < 95) return "bg-success/10";
  if (pct <= 105) return "bg-success/20";
  if (pct <= 120) return "bg-brand-blue/14";
  return "bg-brand-blue/25";
}

/** Revenue in thousands with apostrophe (e.g. 23200 → "23.2'") for narrow embed cells. */
export function formatAllocationEmbedRevenue(n: number) {
  return n > 0
    ? `${(n / 1000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}'`
    : "\u00A0";
}
