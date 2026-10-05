import type { AppKey } from "@/lib/peopleTypes";

export type HomePlannerWeek = {
  year: number;
  week: number;
  bookedHours: number;
  availableHours: number;
};

export type HomePlannerProject = {
  projectId: string;
  customerName: string;
  projectName: string;
  hours: number;
};

export type HomePlannerSurface = {
  consultantName: string | null;
  /** ISO week that is “today”. */
  currentYear: number;
  currentWeek: number;
  weeks: HomePlannerWeek[];
  /** Projects per week, keyed `${year}-${week}`. */
  projectsByWeek: Record<string, HomePlannerProject[]>;
};

export function plannerWeekKey(year: number, week: number): string {
  return `${year}-${week}`;
}

export type HomeTimeReportSurface = {
  year: number;
  week: number;
  reportedHours: number;
  plannedHours: number;
  availableHours: number;
};

export type HomeWorkIssue = {
  id: string;
  key: string;
  title: string;
  statusName: string;
  boardTitle: string;
  customerName: string;
  href: string;
};

export type HomeWorkSurface = {
  issues: HomeWorkIssue[];
};

export type HomeDashboardData = {
  greetingName: string | null;
  year: number;
  week: number;
  unreadCount: number;
  appKeys: AppKey[];
  isCustomerUser: boolean;
  planner: HomePlannerSurface | null;
  timeReport: HomeTimeReportSurface | null;
  work: HomeWorkSurface | null;
};
