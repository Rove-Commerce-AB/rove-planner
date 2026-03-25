import "server-only";

import { createClient } from "@/lib/supabase/server";

export type JiraIssueOption = {
  value: string;
  label: string;
  url?: string | null;
};

export type DevOpsWorkItemOption = {
  value: string;
  label: string;
};

/** Jira issues for a project key (project_key = projects.jira_project_key). */
export async function getJiraIssuesByProjectKey(
  projectKey: string
): Promise<JiraIssueOption[]> {
  if (!projectKey.trim()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jira_issues")
    .select("jira_key, summary, url")
    .eq("project_key", projectKey.trim())
    .order("jira_key");
  if (error) return [];
  return (data ?? []).map(
    (row: { jira_key: string; summary: string | null; url?: string | null }) => ({
      value: row.jira_key,
      label: row.summary ? `${row.jira_key}: ${row.summary}` : row.jira_key,
      url: row.url ?? null,
    })
  );
}

/** DevOps work items for a project name (project = projects.devops_project). */
export async function getDevOpsWorkItemsByProject(
  projectName: string
): Promise<DevOpsWorkItemOption[]> {
  if (!projectName.trim()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devops_work_items")
    .select("work_item_id, title")
    .eq("project", projectName.trim())
    .order("work_item_id");
  if (error) return [];
  return (data ?? []).map(
    (row: { work_item_id: number; title: string | null }) => ({
      value: String(row.work_item_id),
      label: row.title
        ? `${row.work_item_id}: ${row.title}`
        : String(row.work_item_id),
    })
  );
}
