import { unstable_noStore } from "next/cache";
import { getConsultantsWithDetails } from "@/lib/consultants";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { ConsultantsPageClient } from "@/components/ConsultantsPageClient";

export const dynamic = "force-dynamic";

export default async function ConsultantsPage() {
  unstable_noStore();
  const { year, week } = getCurrentYearWeek();
  let consultants: Awaited<ReturnType<typeof getConsultantsWithDetails>> = [];
  let error: string | null = null;

  try {
    consultants = await getConsultantsWithDetails(year, week);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch consultants";
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <ConsultantsPageClient consultants={consultants} error={error} />
      </div>
    </div>
  );
}
