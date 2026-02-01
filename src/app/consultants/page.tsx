import { getConsultantsWithDetails } from "@/lib/consultants";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { ConsultantsPageClient } from "@/components/ConsultantsPageClient";

export default async function ConsultantsPage() {
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
      <ConsultantsPageClient consultants={consultants} error={error} />
    </div>
  );
}
