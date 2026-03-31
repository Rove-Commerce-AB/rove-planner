import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard";
import { getRevenueForecast } from "@/lib/revenueForecast";
import { getCurrentYearWeek, addWeeksToYearWeek } from "@/lib/dateUtils";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getOccupancyReportData, getOccupancyByRoleReport } from "@/lib/occupancyReport";
import { getRoles } from "@/lib/roles";
import { getTeams } from "@/lib/teams";
import { RevenueForecastPanel } from "@/components/RevenueForecastPanel";
import { OccupancyChartPanel } from "@/components/OccupancyChartPanel";
import { RoleOccupancyPanel } from "@/components/RoleOccupancyPanel";
import { PageHeader } from "@/components/ui";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

export const dynamic = "force-dynamic";

const OCCUPANCY_WEEKS_BACK = 2;
const OCCUPANCY_WEEKS_AHEAD = 25;

export default async function ReportsPage() {
  await redirectSubcontractorToAccessDenied();

  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") {
    redirect("/access-denied");
  }

  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();
  const weeks = [];
  for (let i = -OCCUPANCY_WEEKS_BACK; i <= OCCUPANCY_WEEKS_AHEAD; i++) {
    weeks.push(addWeeksToYearWeek(currentYear, currentWeek, i));
  }

  const weeksRoleOccupancy = 21; // 2 back + current + 18 ahead
  const weeksForRoleOccupancy = [];
  for (let i = -2; i < weeksRoleOccupancy - 2; i++) {
    weeksForRoleOccupancy.push(addWeeksToYearWeek(currentYear, currentWeek, i));
  }

  const [roles, teams] = await Promise.all([getRoles(), getTeams()]);
  const [data, forecast, occupancyData, roleOccupancyRows] = await Promise.all([
    getDashboardData(),
    getRevenueForecast(currentYear, 1, currentYear + 1, 52),
    getOccupancyReportData(weeks, undefined, undefined),
    getOccupancyByRoleReport(weeksForRoleOccupancy, roles),
  ]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Reports"
          description={`Week ${data.currentWeek}, ${data.currentYear}`}
          className="mb-6"
        />

        <div className="flex flex-col gap-6">
          <OccupancyChartPanel
            initialData={occupancyData}
            roles={roles}
            teams={teams}
            currentYear={currentYear}
            currentWeek={currentWeek}
          />
          <RoleOccupancyPanel
            rows={roleOccupancyRows}
            currentYear={currentYear}
            currentWeek={currentWeek}
          />
          <RevenueForecastPanel forecast={forecast} currentYear={data.currentYear} />
        </div>
      </div>
    </div>
  );
}
