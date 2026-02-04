export type Consultant = {
  id: string;
  name: string;
  title: string;
  initials: string;
};

export type Project = {
  id: string;
  name: string;
  customerName: string;
  consultantCount: number;
  totalHours: number;
  startDate: string;
  endDate: string;
  color: string;
};

export type ProjectType = "customer" | "internal" | "absence";

export type ProjectWithDetails = {
  id: string;
  name: string;
  isActive: boolean;
  type: ProjectType;
  customer_id: string;
  customerName: string;
  startDate: string | null;
  endDate: string | null;
  consultantCount: number;
  totalHoursAllocated: number;
  consultantInitials: string[];
  color: string;
};

export type WeekAllocation = {
  year: number;
  week: number;
  hours: number;
  projectColor: string;
  /** Available hours for this week (from calendar, minus holidays, × work%). Used for bar width. */
  availableHours?: number;
};

export type ConsultantAllocation = {
  consultant: Consultant;
  weeks: WeekAllocation[];
};

export type DashboardKpis = {
  consultantCount: number;
  customerCount: number;
  activeProjectCount: number;
  allocationThisWeekPercent: number;
};

export type ConsultantWithDetails = {
  id: string;
  name: string;
  email: string | null;
  role_id: string;
  roleName: string;
  calendar_id: string;
  calendarName: string;
  team_id: string | null;
  teamName: string | null;
  isExternal: boolean;
  workPercentage: number;
  /** Share of capacity used for overhead (0–100). Available for projects = capacity × (1 − overhead/100). */
  overheadPercentage: number;
  /** Capacity hours per week (calendar × work%). */
  capacityHoursPerWeek: number;
  /** Available for project allocation (capacity × (1 − overhead/100)). */
  hoursPerWeek: number;
  initials: string;
  weekYear: number;
  weekNumber: number;
  totalHoursAllocated: number;
  allocationPercent: number;
  projectAllocations: { projectName: string; hours: number }[];
};

export type CustomerProjectSummary = {
  id: string;
  name: string;
  isActive: boolean;
};

export type CustomerWithDetails = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  color: string;
  logoUrl: string | null;
  initials: string;
  activeProjectCount: number;
  primaryProject: { name: string; isActive: boolean } | null;
  /** All projects for this customer (detail page) */
  projects: CustomerProjectSummary[];
};

export type DashboardData = {
  currentYear: number;
  currentWeek: number;
  activeProjects: Project[];
};
