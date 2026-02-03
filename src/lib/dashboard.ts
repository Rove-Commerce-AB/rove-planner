import type { DashboardData } from "@/types";
import type { Project } from "@/types";
import { getCurrentYearWeek } from "./dateUtils";
import { getProjectsWithDetails } from "./projects";

/**
 * Fetches dashboard data: current week/year and active projects (real data).
 */
export async function getDashboardData(): Promise<DashboardData> {
  const { week: currentWeek, year: currentYear } = getCurrentYearWeek();

  const withDetails = await getProjectsWithDetails();
  const activeProjects: Project[] = withDetails
    .filter((p) => p.isActive && p.type !== "absence")
    .map((p) => ({
      id: p.id,
      name: p.name,
      customerName: p.customerName,
      consultantCount: p.consultantCount,
      totalHours: p.totalHoursAllocated,
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      color: p.color,
    }));

  return {
    currentYear,
    currentWeek,
    activeProjects,
  };
}
