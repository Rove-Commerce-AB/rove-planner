import { pgDateToDateOnly } from "@/lib/pgDateOnly";

/** Serialize Postgres `DATE` (Date or YYYY-MM-DD string) for `<input type="date" />`. */
export function todoDueDateToInputValue(d: unknown): string {
  if (d == null) return "";
  if (typeof d === "string" || (d instanceof Date && !Number.isNaN(d.getTime()))) {
    try {
      return pgDateToDateOnly(d);
    } catch {
      return "";
    }
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
