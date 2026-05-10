/** Select options for time report dropdowns (value/label). */
export type ProjectOption = { value: string; label: string };

export type JiraDevOpsOption = {
  value: string;
  label: string;
  url?: string | null;
  /** Jira summary or DevOps work item title (for tooltips). */
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
   * When false, copies project, role, Jira/DevOps, and description only — all target days
   * get 0 hours and no internal comments. When true or omitted, copies hours and comments as usual.
   */
  copyHours?: boolean;
  /**
   * Optional target date (`YYYY-MM-DD`) used for rows-only copies to ensure an
   * empty placeholder cell is created in the intended calendar period.
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
