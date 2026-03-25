"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAllocationData } from "@/app/(app)/allocation/actions";
import type { AllocationPageData } from "@/lib/allocationPageTypes";
import { AllocationPageClient } from "./AllocationPageClient";

type Props = {
  data: AllocationPageData | null;
  error: string | null;
  year: number;
  weekFrom: number;
  weekTo: number;
  currentYear: number;
  currentWeek: number;
};

export function AllocationPageWrapper({
  data: initialData,
  error: initialError,
  year: initialYear,
  weekFrom: initialWeekFrom,
  weekTo: initialWeekTo,
  currentYear,
  currentWeek,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<AllocationPageData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [year, setYear] = useState(initialYear);
  const [weekFrom, setWeekFrom] = useState(initialWeekFrom);
  const [weekTo, setWeekTo] = useState(initialWeekTo);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(initialData);
    setError(initialError);
    setYear(initialYear);
    setWeekFrom(initialWeekFrom);
    setWeekTo(initialWeekTo);
  }, [initialData, initialError, initialYear, initialWeekFrom, initialWeekTo]);

  const handleWeekRangeChange = useCallback(
    async (newYear: number, newWeekFrom: number, newWeekTo: number) => {
      setLoading(true);
      try {
        const { data: nextData, error: nextError } = await getAllocationData(
          newYear,
          newWeekFrom,
          newWeekTo
        );
        setData(nextData);
        setError(nextError);
        setYear(newYear);
        setWeekFrom(newWeekFrom);
        setWeekTo(newWeekTo);
        const q = `year=${newYear}&from=${newWeekFrom}&to=${newWeekTo}`;
        router.replace(`/allocation?${q}`, { scroll: false });
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  return (
    <AllocationPageClient
      data={data}
      error={error}
      year={year}
      weekFrom={weekFrom}
      weekTo={weekTo}
      currentYear={currentYear}
      currentWeek={currentWeek}
      onWeekRangeChange={handleWeekRangeChange}
      embedWeekNavLoading={loading}
    />
  );
}
