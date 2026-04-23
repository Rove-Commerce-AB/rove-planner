import { unstable_cache } from "next/cache";
import type { DashboardData } from "@/types";
import type { Project } from "@/types";
import { getCurrentYearWeek, addWeeksToYearWeek } from "./dateUtils";
import { fetchProjectsWithDetails } from "./projectsQueries";
import { getProjectsWithCustomerNames } from "./projects";
import { getConsultantForCurrentUser } from "./consultants";
import { getAllocationsForWeeks } from "./allocations";
import { getRoles } from "./roles";

const DASHBOARD_CACHE_REVALIDATE = 2 * 60;

export type PersonalAllocationRow = {
  year: number;
  week: number;
  customerName: string;
  projectName: string;
  projectId: string;
  roleId: string | null;
  roleName: string;
  hours: number;
};

export type PersonalDashboardData = {
  consultant: { id: string; name: string } | null;
  weeks: { year: number; week: number }[];
  rows: PersonalAllocationRow[];
};

/** Next 10 weeks of allocations for the current user's consultant (linked by email). */
export async function getPersonalDashboardData(): Promise<PersonalDashboardData> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant) {
    return { consultant: null, weeks: [], rows: [] };
  }

  const { year: startYear, week: startWeek } = getCurrentYearWeek();
  const weeks: { year: number; week: number }[] = [];
  for (let i = 0; i < 10; i++) {
    weeks.push(addWeeksToYearWeek(startYear, startWeek, i));
  }

  const allAllocations = await getAllocationsForWeeks(weeks);
  const mine = allAllocations.filter((a) => a.consultant_id === consultant.id);
  if (mine.length === 0) {
    return { consultant, weeks, rows: [] };
  }

  const projectIds = [...new Set(mine.map((a) => a.project_id))];
  const roleIds = [...new Set(mine.map((a) => a.role_id).filter(Boolean))] as string[];
  const [projectsWithCustomer, roles] = await Promise.all([
    getProjectsWithCustomerNames(projectIds),
    getRoles(),
  ]);
  const projectMap = new Map(projectsWithCustomer.map((p) => [p.id, p]));
  const roleMap = new Map(roles.map((r) => [r.id, r.name]));

  const rows: PersonalAllocationRow[] = mine.map((a) => {
    const proj = projectMap.get(a.project_id);
    return {
      year: a.year,
      week: a.week,
      customerName: proj?.customerName ?? "Unknown",
      projectName: proj?.name ?? "Unknown",
      projectId: a.project_id,
      roleId: a.role_id ?? null,
      roleName: a.role_id ? roleMap.get(a.role_id) ?? "—" : "—",
      hours: a.hours,
    };
  });

  rows.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.week !== b.week) return a.week - b.week;
    const cust = a.customerName.localeCompare(b.customerName);
    if (cust !== 0) return cust;
    return a.projectName.localeCompare(b.projectName);
  });

  return { consultant, weeks, rows };
}

/**
 * Fetches dashboard data: current week/year and active projects (real data).
 */
export async function getDashboardData(): Promise<DashboardData> {
  return unstable_cache(
    async () => {
      const { week: currentWeek, year: currentYear } = getCurrentYearWeek();
      const withDetails = await fetchProjectsWithDetails();
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
