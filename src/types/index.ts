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
  /** 1–100, default 100. null treated as 100. */
  probability: number | null;
  consultantCount: number;
  totalHoursAllocated: number;
  consultantInitials: string[];
  color: string;
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
  type: ProjectType;
};

export type CustomerWithDetails = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  accountManagerId: string | null;
  accountManagerName: string | null;
  color: string;
  logoUrl: string | null;
  initials: string;
  isActive: boolean;
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

/** Allocation history audit log: payload for one log entry. Snapshot fields so history shows data at CRUD time. */
export type AllocationHistoryDetails = {
  allocation_ids?: string[];
  hours?: number;
  hours_after?: number;
  hours_removed?: number;
  week_range_removed?: string;
  /** Week range for bulk add e.g. "10–12" */
  week_range?: string;
  customer_name?: string;
  project_name?: string;
  consultant_name?: string;
  year?: number;
  week?: number;
};

/** Allocation history table row (resolved names, week range, etc.). */
export type AllocationHistoryEntry = {
  id: string;
  allocation_id: string | null;
  action: "create" | "update" | "delete" | "bulk";
  changed_by_email: string;
  changed_at: string;
  details: AllocationHistoryDetails | null;
  project_name?: string | null;
  customer_name?: string | null;
  consultant_name?: string | null;
  year?: number | null;
  week?: number | null;
  hours?: number | null;
  week_range?: string | null;
  total_hours?: number | null;
};
