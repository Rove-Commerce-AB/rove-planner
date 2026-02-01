import { getCurrentYearWeek } from "@/lib/dateUtils";
import { getAllocationPageData } from "@/lib/allocationPage";
import { AllocationPageClient } from "@/components/AllocationPageClient";

const DEFAULT_WEEKS_VISIBLE = 20;

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
    toParam ?? Math.min(52, weekFrom + DEFAULT_WEEKS_VISIBLE - 1);

  let data = null;
  let error: string | null = null;

  try {
    data = await getAllocationPageData(year, weekFrom, weekTo);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load allocation data";
  }

  return (
    <div className="p-6">
      <AllocationPageClient
        data={data}
        error={error}
        year={year}
        weekFrom={weekFrom}
        weekTo={weekTo}
      />
    </div>
  );
}
