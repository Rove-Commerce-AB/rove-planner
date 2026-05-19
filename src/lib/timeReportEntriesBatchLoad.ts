import type { TimeReportWeekData } from "@/types/timeReport";

type LoadTimeReportWeek = (
  consultantId: string,
  year: number,
  week: number,
  calendarMonthForLineFilter?: { year: number; month: number }
) => Promise<TimeReportWeekData>;

/** One loader call per week, same order as input (parity with N× single-week loads). */
export async function loadTimeReportEntriesForWeeksSequential(
  loadWeek: LoadTimeReportWeek,
  consultantId: string,
  weeks: { year: number; week: number }[],
  calendarMonthForLineFilter?: { year: number; month: number } | null
): Promise<TimeReportWeekData[]> {
  const out: TimeReportWeekData[] = [];
  const monthFilter = calendarMonthForLineFilter ?? undefined;
  for (const { year, week } of weeks) {
    out.push(await loadWeek(consultantId, year, week, monthFilter));
  }
  return out;
}
