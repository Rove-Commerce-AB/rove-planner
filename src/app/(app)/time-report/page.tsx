import { getConsultantForCurrentUser } from "@/lib/consultants";
import { getCustomerIdsForConsultant } from "@/lib/customerConsultants";
import { getCustomersByIds } from "@/lib/customers";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { PageHeader } from "@/components/ui";
import { TimeReportPageClient } from "./TimeReportPageClient";
import { getHolidayDatesForWeek } from "./actions";

export const dynamic = "force-dynamic";

export default async function TimeReportPage() {
  const consultant = await getConsultantForCurrentUser();
  const customerIds = consultant
    ? await getCustomerIdsForConsultant(consultant.id)
    : [];
  const customers = await getCustomersByIds(customerIds);
  const { year: initialYear, week: initialWeek } = getCurrentYearWeek();
  const initialHolidayDates =
    consultant?.calendar_id != null
      ? await getHolidayDatesForWeek(
          consultant.calendar_id,
          initialYear,
          initialWeek
        )
      : [];

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          title="Time report"
          className="mb-6"
        />
        <TimeReportPageClient
          consultant={consultant}
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color ?? undefined,
          }))}
          initialYear={initialYear}
          initialWeek={initialWeek}
          calendarId={consultant?.calendar_id ?? null}
          initialHolidayDates={initialHolidayDates}
        />
      </div>
    </div>
  );
}
