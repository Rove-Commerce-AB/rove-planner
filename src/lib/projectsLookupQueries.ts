import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProjectType } from "@/types";

const PROJECT_SELECT =
  "id,customer_id,name,is_active,type,project_manager_id,start_date,end_date,probability,jira_project_key,devops_project,budget_hours,budget_money";

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
  supabase: SupabaseClient,
  customerIds: string[]
): Promise<ProjectRecordRow[]> {
  if (customerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .in("customer_id", customerIds);

  if (error) throw error;
  return (data ?? []) as ProjectRecordRow[];
}

export async function fetchProjectsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", ids);

  if (error) throw error;
  return data ?? [];
}
