/**
 * Returns current ISO 8601 week and year.
 * ISO week: Mon–Sun, week 1 contains Jan 4.
 */
export function getCurrentYearWeek(): { year: number; week: number } {
  const now = new Date();
  // ISO day: Mon=1 .. Sun=7 (JS getDay: Sun=0, Mon=1, ...)
  const isoDay = now.getDay() || 7;
  // Thursday (ISO 4) defines the week
  const thursdayOffset = 4 - isoDay;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + thursdayOffset);
  const year = thursday.getFullYear();
  // Week 1 = week containing Jan 4
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(4 - jan4Day + 1);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const week =
    1 +
    Math.floor((thursday.getTime() - week1Monday.getTime()) / msPerWeek);
  return { year, week };
}

/** Returns ISO week Monday and Sunday as YYYY-MM-DD for the given year and week. */
export function getISOWeekDateRange(
  year: number,
  week: number
): { start: string; end: string } {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1 = Mon, 7 = Sun
  const yearStartMonday = new Date(jan4);
  yearStartMonday.setDate(jan4.getDate() - dayOfWeek + 1);

  const weekStart = new Date(yearStartMonday);
  weekStart.setDate(yearStartMonday.getDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const toYMD = (d: Date) =>
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0");

  return { start: toYMD(weekStart), end: toYMD(weekEnd) };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/** Returns month (1–12) for the given ISO year+week (based on week's Monday). */
export function getMonthForWeek(year: number, week: number): number {
  const { start } = getISOWeekDateRange(year, week);
  return parseInt(start.slice(5, 7), 10);
}

/** Returns display label and year for the given month (1–12) and year. */
export function getMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Builds month spans for a list of weeks: [{ label, colSpan }, ...]. */
export function getMonthSpansForWeeks(
  weeks: { year: number; week: number }[]
): { label: string; colSpan: number }[] {
  if (weeks.length === 0) return [];
  const spans: { label: string; colSpan: number }[] = [];
  let currentMonth = getMonthForWeek(weeks[0].year, weeks[0].week);
  let currentYear = weeks[0].year;
  let count = 1;
  for (let i = 1; i < weeks.length; i++) {
    const m = getMonthForWeek(weeks[i].year, weeks[i].week);
    const y = weeks[i].year;
    if (m !== currentMonth || y !== currentYear) {
      spans.push({
        label: getMonthLabel(currentMonth, currentYear),
        colSpan: count,
      });
      currentMonth = m;
      currentYear = y;
      count = 1;
    } else {
      count++;
    }
  }
  spans.push({
    label: getMonthLabel(currentMonth, currentYear),
    colSpan: count,
  });
  return spans;
}
