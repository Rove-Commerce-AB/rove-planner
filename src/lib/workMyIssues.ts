import "server-only";

import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/appUsers";
import { fetchLoggedHoursByIssueIds } from "@/lib/workIssuesQueries";
import { workIssueKey } from "@/lib/workIssueKey";
import { workSprintLabel } from "@/lib/workSprintLabel";
import {
  fetchMemberWorkProjectIds,
  fetchMyWorkIssues,
} from "@/lib/workMyIssuesQueries";
import type { WorkIssuePriority, WorkIssueType } from "@/lib/workTypes";

export type WorkMyIssue = {
  id: string;
  key: string;
  title: string;
  issueType: WorkIssueType;
  priority: WorkIssuePriority | null;
  statusId: string;
  statusName: string;
  isDone: boolean;
  customerId: string;
  customerName: string;
  projectId: string;
  projectTitle: string;
  sprintLabel: string | null;
  estimateHours: number | null;
  loggedHours: number;
  dueDate: string | null;
  isOwner: boolean;
  isAssignee: boolean;
};

export async function listMyWorkIssues(): Promise<WorkMyIssue[]> {
  const user = await getCurrentAppUser();
  if (!user || !user.appKeys.includes("work")) redirect("/access-denied");

  const projectIds = await fetchMemberWorkProjectIds(user.id);
  const rows = await fetchMyWorkIssues(projectIds, user.id);
  const loggedHours = await fetchLoggedHoursByIssueIds(rows.map((row) => row.id));

  return rows.map((row) => ({
    id: row.id,
    key: workIssueKey(row.project_prefix, row.number),
    title: row.title,
    issueType: row.issue_type,
    priority: row.priority,
    statusId: row.status_id,
    statusName: row.status_name,
    isDone: row.is_done,
    customerId: row.customer_id,
    customerName: row.customer_name,
    projectId: row.project_id,
    projectTitle: row.project_title,
    sprintLabel:
      row.sprint_number == null
        ? null
        : workSprintLabel({
            number: row.sprint_number,
            title: row.sprint_title ?? "",
          }),
    estimateHours:
      row.estimate_hours == null ? null : Number(row.estimate_hours),
    loggedHours: loggedHours.get(row.id) ?? 0,
    dueDate: typeof row.due_date === "string" ? row.due_date : null,
    isOwner: row.is_owner,
    isAssignee: row.is_assignee,
  }));
}
