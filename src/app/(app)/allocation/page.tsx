export const dynamic = "force-dynamic";

import { getCurrentYearWeek } from "@/lib/dateUtils";
import { getAllocationPageData } from "@/lib/allocationPage";
import { AllocationPageClient } from "@/components/AllocationPageClient";
import { AllocationViewportAdapter } from "@/components/AllocationViewportAdapter";

const FALLBACK_WEEKS = 12;

type Props = {
  searchParams: Promise<{ year?: string; from?: string; to?: string }>;
};

export default async function AllocationPage({ searchParams }: Props) {
  const params = await searchParams;
  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();

  const year = params.year ? parseInt(params.year, 10) : currentYear;
  const fromParam = params.from ? parseInt(params.from, 10) : null;
  const toParam = params.to ? parseInt(params.to, 10) : null;

  const weekFrom =
    fromParam ?? Math.max(1, currentWeek - 2);
  const weekTo =
    toParam ?? Math.min(52, weekFrom + FALLBACK_WEEKS - 1);

  let data = null;
  let error: string | null = null;

  try {
    data = await getAllocationPageData(year, weekFrom, weekTo);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load allocation data";
  }

  return (
    <AllocationViewportAdapter
      year={year}
      weekFrom={weekFrom}
      weekTo={weekTo}
    >
      <div className="p-6">
        <AllocationPageClient
          data={data}
          error={error}
          year={year}
          weekFrom={weekFrom}
          weekTo={weekTo}
          currentYear={currentYear}
          currentWeek={currentWeek}
        />
      </div>
    </AllocationViewportAdapter>
  );
}
