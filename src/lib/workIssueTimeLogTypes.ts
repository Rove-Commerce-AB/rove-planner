export type WorkIssueTimeLogEntry = {
  id: string;
  date: string;
  hours: number;
  note: string | null;
  consultantId: string;
  consultantName: string;
};

export type WorkIssueTimeLogRoleOption = {
  id: string;
  name: string;
};

export type WorkIssueTimeLogState = {
  canLog: boolean;
  cannotLogReason: string | null;
  /** Current user's consultant id when they can own/edit entries; null otherwise. */
  currentConsultantId: string | null;
  /** Billing roles/rates available for this Work project's planner project. */
  roleOptions: WorkIssueTimeLogRoleOption[];
  /** Prefill for the Role select (consultant default when available). */
  defaultRoleId: string | null;
  entries: WorkIssueTimeLogEntry[];
  loggedHours: number;
};
