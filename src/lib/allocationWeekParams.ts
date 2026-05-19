import { isoWeeksInYear } from "./dateUtils";

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
