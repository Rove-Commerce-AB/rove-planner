import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard";
import { getRevenueForecast } from "@/lib/revenueForecast";
import { getCurrentYearWeek, addWeeksToYearWeek } from "@/lib/dateUtils";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getOccupancyReportData, getOccupancyByRoleReport } from "@/lib/occupancyReport";
import { getRoles } from "@/lib/roles";
import { RevenueForecastPanel } from "@/components/RevenueForecastPanel";
import { OccupancyChartPanel } from "@/components/OccupancyChartPanel";
import { RoleOccupancyPanel } from "@/components/RoleOccupancyPanel";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const OCCUPANCY_WEEKS_BACK = 2;
const OCCUPANCY_WEEKS_AHEAD = 25;

export default async function ReportsPage() {
  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") {
    redirect("/access-denied");
  }

  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();
  const weeks = [];
  for (let i = -OCCUPANCY_WEEKS_BACK; i <= OCCUPANCY_WEEKS_AHEAD; i++) {
    weeks.push(addWeeksToYearWeek(currentYear, currentWeek, i));
  }

  const weeksNext10 = [];
  for (let i = 0; i < 10; i++) {
    weeksNext10.push(addWeeksToYearWeek(currentYear, currentWeek, i));
  }

  const roles = await getRoles();
  const [data, forecast, occupancyData, roleOccupancyRows] = await Promise.all([
    getDashboardData(),
    getRevenueForecast(currentYear, 1, currentYear + 1, 52),
    getOccupancyReportData(weeks, undefined),
    getOccupancyByRoleReport(weeksNext10, roles),
  ]);

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <PageHeader
          title="Reports"
          description={`Week ${data.currentWeek}, ${data.currentYear}`}
          className="mb-6"
        />

        <div className="flex flex-col gap-6">
          <OccupancyChartPanel
            initialData={occupancyData}
            roles={roles}
            currentYear={currentYear}
            currentWeek={currentWeek}
          />
          <RoleOccupancyPanel rows={roleOccupancyRows} />
          <RevenueForecastPanel forecast={forecast} currentYear={data.currentYear} />
        </div>
      </div>
    </div>
  );
}
