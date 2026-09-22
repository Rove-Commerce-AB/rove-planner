import { addWeeksToYearWeek, isoWeeksInYear } from "./dateUtils";

/** Weeks shown before the current week on the planner's default landing. */
export const ALLOCATION_WEEKS_BEFORE_CURRENT = 2;

export function buildWeeksArray(
  year: number,
  weekFrom: number,
  weekTo: number
): { year: number; week: number }[] {
  if (weekFrom <= weekTo) {
    return Array.from({ length: weekTo - weekFrom + 1 }, (_, i) => ({
      year,
      week: weekFrom + i,
    }));
  }
  const weeks: { year: number; week: number }[] = [];
  const maxWeek = isoWeeksInYear(year);
  for (let w = weekFrom; w <= maxWeek; w++) weeks.push({ year, week: w });
  for (let w = 1; w <= weekTo; w++) weeks.push({ year: year + 1, week: w });
  return weeks;
}

export function allocationWeekSpan(
  year: number,
  weekFrom: number,
  weekTo: number
): number {
  return buildWeeksArray(year, weekFrom, weekTo).length;
}

export function allocationRangeIncludesWeek(
  range: { year: number; weekFrom: number; weekTo: number },
  target: { year: number; week: number }
): boolean {
  return buildWeeksArray(range.year, range.weekFrom, range.weekTo).some(
    (week) => week.year === target.year && week.week === target.week
  );
}

/**
 * Same-width window with the current week a couple of columns in from the left,
 * so paging away and jumping back lands in a familiar place.
 */
export function allocationWindowAroundWeek(
  currentYear: number,
  currentWeek: number,
  span: number,
  weeksBefore = ALLOCATION_WEEKS_BEFORE_CURRENT
): { year: number; weekFrom: number; weekTo: number } {
  const width = Math.max(1, span);
  const lead = Math.max(0, Math.min(weeksBefore, width - 1));
  const first = addWeeksToYearWeek(currentYear, currentWeek, -lead);
  const last = addWeeksToYearWeek(first.year, first.week, width - 1);
  return { year: first.year, weekFrom: first.week, weekTo: last.week };
}
