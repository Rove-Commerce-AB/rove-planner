import { useCallback } from "react";
import { usePathname, useSearchParams, type useRouter } from "next/navigation";
import { addWeeksToYearWeek } from "@/lib/dateUtils";
import { allocationHrefWithWeek } from "@/lib/allocationUrl";

export const ALLOCATION_WEEK_STEP = 1;
export const ALLOCATION_WEEK_PAGE = 5;

type EmbedMode = { projectId: string } | undefined;

type AppRouter = Pick<ReturnType<typeof useRouter>, "push" | "prefetch">;

export function useAllocationWeekNavigation(
  router: AppRouter,
  year: number,
  weekFrom: number,
  weekTo: number,
  embedMode: EmbedMode,
  onWeekRangeChange?: (
    year: number,
    weekFrom: number,
    weekTo: number
  ) => void | Promise<void>
) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const shiftedRange = useCallback(
    (weeks: number): { year: number; weekFrom: number; weekTo: number } => {
      const { first, last } = getFirstLastWeek();
      const newFirst = addWeeksToYearWeek(first.year, first.week, weeks);
      const newLast = addWeeksToYearWeek(last.year, last.week, weeks);
      return {
        year: newFirst.year,
        weekFrom: newFirst.week,
        weekTo: newLast.week,
      };
    },
    [getFirstLastWeek]
  );

  const getShiftUrl = useCallback(
    (weeks: number) => {
      const range = shiftedRange(weeks);
      if (embedMode) {
        return allocationHrefWithWeek(
          `/projects/${embedMode.projectId}`,
          { year: range.year, from: range.weekFrom, to: range.weekTo },
          searchParams
        );
      }
      return allocationHrefWithWeek(
        pathname,
        { year: range.year, from: range.weekFrom, to: range.weekTo },
        searchParams
      );
    },
    [embedMode, pathname, searchParams, shiftedRange]
  );

  const shiftWeeks = useCallback(
    (weeks: number) => {
      if (onWeekRangeChange) {
        const range = shiftedRange(weeks);
        void onWeekRangeChange(range.year, range.weekFrom, range.weekTo);
        return;
      }
      router.push(getShiftUrl(weeks));
    },
    [onWeekRangeChange, shiftedRange, router, getShiftUrl]
  );

  return {
    shiftWeeks,
    getShiftUrl,
  };
}
