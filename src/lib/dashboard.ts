import type { DashboardData } from "@/types";
import {
  DEFAULT_CUSTOMER_COLOR,
  MOCK_CHART_COLORS,
  DEFAULT_PROJECT_COLOR,
  DEFAULT_HOURS_PER_WEEK,
} from "./constants";
import { getCurrentYearWeek } from "./dateUtils";

/**
 * Fetches dashboard data. Will use Supabase when allocations/projects exist.
 * Returns mock data for MVP structure.
 */
export async function getDashboardData(): Promise<DashboardData> {
  // TODO: Replace with Supabase queries when tables exist
  const { week: currentWeek, year: currentYear } = getCurrentYearWeek();

  const consultants = [
    { id: "1", name: "Anna Andersson", title: "Senior Developer", initials: "AA" },
    { id: "2", name: "Erik Eriksson", title: "UX Designer", initials: "EE" },
    { id: "3", name: "Maria Nilsson", title: "Project Manager", initials: "MN" },
    { id: "4", name: "Johan Svensson", title: "Backend Developer", initials: "JS" },
    { id: "5", name: "Lisa Johansson", title: "Frontend Developer", initials: "LJ" },
    { id: "6", name: "Peter Karlsson", title: "DevOps Engineer", initials: "PK" },
  ];

  const allocationsPerWeek = consultants.map((c, i) => ({
    consultant: c,
    weeks: [
      {
        year: currentYear,
        week: currentWeek,
        hours: i === 4 ? 32 : DEFAULT_HOURS_PER_WEEK,
        projectColor: MOCK_CHART_COLORS[i % 4],
        availableHours: DEFAULT_HOURS_PER_WEEK,
      },
      {
        year: currentYear,
        week: currentWeek + 1,
        hours: i === 4 ? 32 : DEFAULT_HOURS_PER_WEEK,
        projectColor: MOCK_CHART_COLORS[(i + 1) % 4],
        availableHours: DEFAULT_HOURS_PER_WEEK,
      },
      ...Array.from({ length: 4 }, (_, j) => ({
        year: currentYear,
        week: currentWeek + 2 + j,
        hours: 0,
        projectColor: DEFAULT_PROJECT_COLOR,
        availableHours: DEFAULT_HOURS_PER_WEEK,
      })),
    ],
  }));

  const activeProjects = [
    {
      id: "1",
      name: "E-commerce Platform",
      customerName: "Volvo Cars",
      consultantCount: 4,
      totalHours: 196,
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      color: DEFAULT_CUSTOMER_COLOR,
    },
    {
      id: "2",
      name: "Mobile App Redesign",
      customerName: "Spotify",
      consultantCount: 2,
      totalHours: 72,
      startDate: "2025-01-15",
      endDate: "2025-04-30",
      color: "#22c55e",
    },
    {
      id: "3",
      name: "Internal Dashboard",
      customerName: "IKEA",
      consultantCount: 3,
      totalHours: 104,
      startDate: "2025-02-01",
      endDate: "2025-03-31",
      color: "#a855f7",
    },
  ];

  return {
    currentYear,
    currentWeek,
    kpis: {
      consultantCount: 6,
      customerCount: 4,
      activeProjectCount: 4,
      allocationThisWeekPercent: 98,
    },
    allocationsPerWeek,
    activeProjects,
  };
}
