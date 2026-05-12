/** Select options for time report dropdowns (value/label). */
export type ProjectOption = { value: string; label: string };

export type JiraDevOpsOption = {
  value: string;
  label: string;
  url?: string | null;
  /** Jira/ClickUp summary or DevOps work item title (for tooltips). */
  description?: string | null;
};

export type TaskOption = { value: string; label: string };

/** One row in the time report grid (7 days of hours + per-day comments). */
export type TimeReportEntry = {
  id: string;
  /** Line ordering from DB (`time_report_entry_lines.display_order`); separates duplicate project/role rows. */
  displayOrder: number;
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
  /** Optional stable line id to reuse across multiple target weeks in one copy operation. */
  lineId?: string;
  /**
   * When set, used as `time_report_entry_lines.display_order` (and cell `display_order`) for this
   * operation on every target week. Keeps month-view merge keys stable across ISO weeks.
   */
  lineDisplayOrder?: number;
  projectId: string;
  roleId: string;
  jiraDevOpsValue: string;
  task: string;
  hours: number[];
  comments: Record<number, string>;
  /**
   * When false, copies project, role, Jira/DevOps/ClickUp, and description only — creates line header
   * stubs without `time_report_entries` rows. When true or omitted, copies hours and comments as usual.
   */
  copyHours?: boolean;
  /**
   * Optional calendar date (`YYYY-MM-DD`) within the visible scope: sets stub line header
   * `created_at` / `updated_at` so month filtering still surfaces header-only rows.
   */
  rowOnlyAnchorDate?: string;
};

/** One copy operation inside an atomic month batch (`copyTimeReportEntriesBatch`). */
export type TimeReportCopyBatchOperation = {
  targetYear: number;
  targetWeek: number;
  customerId: string;
  entry: TimeReportEntryCopyPayload;
};

/** Result of loading one ISO week of time report data (includes revision for optimistic locking). */
export type TimeReportWeekData = {
  groups: TimeReportCustomerGroup[];
  /** Increments on every successful write to this consultant/week. */
  revision: number;
};

export type SaveTimeReportEntriesResult =
  | { success: true; revision: number }
  | { success: false; error: string; code?: "revision_conflict"; currentRevision?: number };

export type CopyEntryToWeekResult = SaveTimeReportEntriesResult;

/** Result of `copyTimeReportEntriesBatch` — revisions for every touched ISO week after commit. */
export type CopyTimeReportEntriesBatchResult =
  | { success: true; weekRevisions: Record<string, number> }
  | { success: false; error: string; code?: "revision_conflict"; currentRevision?: number };
