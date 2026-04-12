import { cloudSqlPool } from "@/lib/cloudSqlPool";

import type { ProjectType } from "@/types";

const PROJECT_SELECT =
  "id, customer_id, name, is_active, type, project_manager_id, start_date::text, end_date::text, probability, jira_project_key, devops_project, budget_hours, budget_money";

export type ProjectRecordRow = {
  id: string;
  customer_id: string;
  name: string;
  is_active: boolean;
  type: ProjectType;
  project_manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  probability: number | null;
  jira_project_key: string | null;
  devops_project: string | null;
  budget_hours: number | null;
  budget_money: number | null;
};

export async function fetchProjectsByCustomerIds(
  customerIds: string[]
): Promise<ProjectRecordRow[]> {
  if (customerIds.length === 0) return [];

  const { rows } = await cloudSqlPool.query<ProjectRecordRow>(
    `SELECT ${PROJECT_SELECT} FROM projects WHERE customer_id = ANY($1::uuid[])`,
    [customerIds]
  );
  return rows.map((r) => ({
    ...r,
    probability: r.probability != null ? Number(r.probability) : null,
    budget_hours: r.budget_hours != null ? Number(r.budget_hours) : null,
    budget_money: r.budget_money != null ? Number(r.budget_money) : null,
  }));
}

export async function fetchProjectsByIds(
  ids: string[]
): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return [];

  const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
    `SELECT id, name FROM projects WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}
