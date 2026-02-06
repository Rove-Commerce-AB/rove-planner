import { unstable_cache } from "next/cache";
import type { DashboardData } from "@/types";
import type { Project } from "@/types";
import { getCurrentYearWeek } from "./dateUtils";
import { getProjectsWithDetails } from "./projects";

const DASHBOARD_CACHE_REVALIDATE = 60;

/**
 * Fetches dashboard data: current week/year and active projects (real data).
 */
export async function getDashboardData(): Promise<DashboardData> {
  return unstable_cache(
    async () => {
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
    },
    ["dashboard-data"],
    { revalidate: DASHBOARD_CACHE_REVALIDATE, tags: ["dashboard"] }
  )();
}
