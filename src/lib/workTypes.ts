import type { WorkBoardStatus, WorkIssueStatus } from "@/lib/workStatuses";
import type { WorkIssueRelations } from "@/lib/workIssueRelations";

export type { WorkIssueRelations };

export type { WorkBoardStatus, WorkIssueStatus };

export const WORK_FILE_MAX_BYTES = 8 * 1024 * 1024;

export type WorkSelectorBoard = {
  id: string;
  title: string;
  prefix: string;
};

export type WorkSelectorCustomer = {
  id: string;
  name: string;
  color: string | null;
  url: string | null;
  isInternal: boolean;
  boards: WorkSelectorBoard[];
};

export type WorkCustomerView = WorkSelectorCustomer & {
  archivedBoards: WorkSelectorBoard[];
};

export type WorkPerson = {
  id: string;
  name: string;
  initials: string;
};

export type WorkLabel = {
  id: string;
  name: string;
};

export type WorkComment = {
  id: string;
  body: string;
  createdAt: string;
  author: WorkPerson;
};

export type WorkEvent = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
  actor: WorkPerson;
};

export type WorkFile = {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

export type WorkIssue = {
  id: string;
  number: number;
  key: string;
  title: string;
  status: WorkIssueStatus;
  sortOrder: number;
  description: string;
  currentState: string;
  nextStep: string;
  owner: WorkPerson | null;
  reporter: WorkPerson | null;
  assignees: WorkPerson[];
  labels: WorkLabel[];
  comments: WorkComment[];
  events: WorkEvent[];
  files: WorkFile[];
  relations: WorkIssueRelations;
  estimateHours: number | null;
  loggedHours: number;
};

export type WorkBoardView = {
  id: string;
  title: string;
  prefix: string;
  customerId: string;
  customerName: string;
  currentUser: WorkPerson;
  people: WorkPerson[];
  members: WorkPerson[];
  statuses: WorkBoardStatus[];
  boardLabels: WorkLabel[];
  issues: WorkIssue[];
};
