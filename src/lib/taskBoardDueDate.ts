/** Serialize Postgres `DATE` (Date or YYYY-MM-DD string) for `<input type="date" />`. */
export function todoDueDateToInputValue(d: unknown): string {
  if (d == null) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    // Never use toISOString() for calendar dates: UTC midnight can become the wrong
    // calendar day in some timezones. Prefer UTC *calendar* parts (matches pg DATE → UTC midnight).
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return "";
}

/** Human-readable label from `YYYY-MM-DD` (calendar date, local display). */
export function formatTodoDueDateLabel(isoYYYYMMDD: string | null | undefined): string {
  if (!isoYYYYMMDD || isoYYYYMMDD.length !== 10) return "";
  const parts = isoYYYYMMDD.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return "";
  try {
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoYYYYMMDD;
  }
}
