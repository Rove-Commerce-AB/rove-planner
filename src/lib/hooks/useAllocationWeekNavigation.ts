import { useCallback } from "react";
import type { useRouter } from "next/navigation";
import { addWeeksToYearWeek } from "@/lib/dateUtils";

const SHIFT_WEEKS = 4;

type EmbedMode = { projectId: string } | undefined;

type AppRouter = Pick<ReturnType<typeof useRouter>, "push" | "prefetch">;

export function useAllocationWeekNavigation(
  router: AppRouter,
  year: number,
  weekFrom: number,
  weekTo: number,
  embedMode: EmbedMode,
  onWeekRangeChange?: (year: number, weekFrom: number, weekTo: number) => void | Promise<void>
) {
  const getFirstLastWeek = useCallback((): {
    first: { year: number; week: number };
    last: { year: number; week: number };
  } => {
    if (weekFrom <= weekTo) {
      return { first: { year, week: weekFrom }, last: { year, week: weekTo } };
    }
    return {
      first: { year, week: weekFrom },
      last: { year: year + 1, week: weekTo },
    };
  }, [year, weekFrom, weekTo]);

  const toUrl = useCallback(
    (first: { year: number; week: number }, last: { year: number; week: number }) => {
      const q = `year=${first.year}&from=${first.week}&to=${last.week}`;
      if (embedMode) {
        return `/projects/${embedMode.projectId}?${q}`;
      }
      return `/allocation?${q}`;
    },
    [embedMode]
  );

  const getPreviousUrl = useCallback(() => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, -SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, -SHIFT_WEEKS);
    return toUrl(newFirst, newLast);
  }, [getFirstLastWeek, toUrl]);

  const getNextUrl = useCallback(() => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, SHIFT_WEEKS);
    return toUrl(newFirst, newLast);
  }, [getFirstLastWeek, toUrl]);

  const getPreviousRange = useCallback((): {
    year: number;
    weekFrom: number;
    weekTo: number;
  } => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, -SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, -SHIFT_WEEKS);
    return { year: newFirst.year, weekFrom: newFirst.week, weekTo: newLast.week };
  }, [getFirstLastWeek]);

  const getNextRange = useCallback((): {
    year: number;
    weekFrom: number;
    weekTo: number;
  } => {
    const { first, last } = getFirstLastWeek();
    const newFirst = addWeeksToYearWeek(first.year, first.week, SHIFT_WEEKS);
    const newLast = addWeeksToYearWeek(last.year, last.week, SHIFT_WEEKS);
    return { year: newFirst.year, weekFrom: newFirst.week, weekTo: newLast.week };
  }, [getFirstLastWeek]);

  const goToPreviousWeeks = useCallback(() => {
    if (onWeekRangeChange) {
      const { year: y, weekFrom: f, weekTo: t } = getPreviousRange();
      void onWeekRangeChange(y, f, t);
      return;
    }
    router.push(getPreviousUrl());
  }, [onWeekRangeChange, getPreviousRange, router, getPreviousUrl]);

  const goToNextWeeks = useCallback(() => {
    if (onWeekRangeChange) {
      const { year: y, weekFrom: f, weekTo: t } = getNextRange();
      void onWeekRangeChange(y, f, t);
      return;
    }
    router.push(getNextUrl());
  }, [onWeekRangeChange, getNextRange, router, getNextUrl]);

  return {
    getPreviousUrl,
    getNextUrl,
    goToPreviousWeeks,
    goToNextWeeks,
  };
}
