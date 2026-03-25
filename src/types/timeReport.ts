/** Select options for time report dropdowns (value/label). */
export type ProjectOption = { value: string; label: string };

export type JiraDevOpsOption = {
  value: string;
  label: string;
  url?: string | null;
};

export type TaskOption = { value: string; label: string };

/** One row in the time report grid (7 days of hours + per-day comments). */
export type TimeReportEntry = {
  id: string;
  projectId: string;
  roleId: string;
  jiraDevOpsValue: string;
  task: string;
  hours: number[];
  comments: Record<number, string>;
};

export type TimeReportCustomerGroup = {
  customerId: string;
  entries: TimeReportEntry[];
};

/** Payload for copying a single entry to another week (subset of TimeReportEntry). */
export type TimeReportEntryCopyPayload = {
  projectId: string;
  roleId: string;
  jiraDevOpsValue: string;
  task: string;
  hours: number[];
  comments: Record<number, string>;
};
