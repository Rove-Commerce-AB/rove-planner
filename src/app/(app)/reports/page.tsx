import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard";
import { getRevenueForecast } from "@/lib/revenueForecast";
import {
  getCurrentYearWeek,
  addWeeksToYearWeek,
  getCurrentCalendarYearMonth,
} from "@/lib/dateUtils";
import {
  expandYearWeekRangeInclusive,
  getAllocationBudgetDrilldown,
} from "@/lib/allocationBudgetReport";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getReportsOccupancyData } from "@/lib/occupancyReport";
import { getRoles } from "@/lib/roles";
import { getTeams } from "@/lib/teams";
import { RevenueForecastPanel } from "@/components/RevenueForecastPanel";
import { OccupancyChartPanel } from "@/components/OccupancyChartPanel";
import { BillableUtilizationMonthlyPanel } from "@/components/BillableUtilizationMonthlyPanel";
import { getBillableUtilizationMonthlyReport } from "@/lib/billableUtilizationReport";
import { RoleOccupancyPanel } from "@/components/RoleOccupancyPanel";
import { AllocationBudgetDrilldownPanel } from "@/components/AllocationBudgetDrilldownPanel";
import { PageHeader } from "@/components/ui";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

export const dynamic = "force-dynamic";

const OCCUPANCY_WEEKS_BACK = 2;
const OCCUPANCY_WEEKS_AHEAD = 25;
const OCCUPANCY_MONTHS_BACK = 2;
const OCCUPANCY_MONTH_WINDOW = 12;

function addCalendarMonths(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function buildOccupancyMonthRange(
  anchorYear: number,
  anchorMonth: number
): { year: number; month: number }[] {
  const start = addCalendarMonths(anchorYear, anchorMonth, -OCCUPANCY_MONTHS_BACK);
  const months: { year: number; month: number }[] = [];
  let y = start.year;
  let m = start.month;
  for (let i = 0; i < OCCUPANCY_MONTH_WINDOW; i++) {
    months.push({ year: y, month: m });
    const next = addCalendarMonths(y, m, 1);
    y = next.year;
    m = next.month;
  }
  return months;
}

export default async function ReportsPage() {
  await redirectSubcontractorToAccessDenied();

  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") {
    redirect("/access-denied");
  }

  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();
  const { year: calendarYear, month: calendarMonth } = getCurrentCalendarYearMonth();
  const occupancyMonths = buildOccupancyMonthRange(calendarYear, calendarMonth);
  const weeks = [];
  for (let i = -OCCUPANCY_WEEKS_BACK; i <= OCCUPANCY_WEEKS_AHEAD; i++) {
    weeks.push(addWeeksToYearWeek(currentYear, currentWeek, i));
  }

  const weeksRoleOccupancy = 21; // 2 back + current + 18 ahead
  const weeksForRoleOccupancy = [];
  for (let i = -2; i < weeksRoleOccupancy - 2; i++) {
    weeksForRoleOccupancy.push(addWeeksToYearWeek(currentYear, currentWeek, i));
  }

  const allocStart = addWeeksToYearWeek(currentYear, currentWeek, -2);
  const allocEnd = addWeeksToYearWeek(currentYear, currentWeek, 25);
  const allocWeeks = expandYearWeekRangeInclusive(allocStart, allocEnd);

  const [roles, teams] = await Promise.all([getRoles(), getTeams()]);
  const occupancyBundlePromise = getReportsOccupancyData(
    weeks,
    weeksForRoleOccupancy,
    roles
  );
  const [
    data,
    forecast,
    occupancyBundle,
    billableUtilizationData,
    allocationBudgetDrilldown,
  ] = await Promise.all([
    getDashboardData(),
    getRevenueForecast(currentYear, 1, currentYear + 1, 52),
    occupancyBundlePromise,
    getBillableUtilizationMonthlyReport(occupancyMonths, undefined, "weighted"),
    getAllocationBudgetDrilldown(allocWeeks),
  ]);
  const occupancyData = occupancyBundle.chart;
  const roleOccupancyRows = occupancyBundle.byRole;

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
          <BillableUtilizationMonthlyPanel
            initialData={billableUtilizationData}
            teams={teams}
            anchorYear={calendarYear}
            anchorMonth={calendarMonth}
          />
          <AllocationBudgetDrilldownPanel
            initialData={allocationBudgetDrilldown}
            initialFrom={allocStart}
            initialTo={allocEnd}
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
