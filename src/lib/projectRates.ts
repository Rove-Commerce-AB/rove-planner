import { supabase } from "./supabaseClient";

export type ProjectRate = {
  id: string;
  project_id: string;
  role_id: string;
  rate_per_hour: number;
  currency: string;
};

export async function getProjectRates(
  projectId: string
): Promise<ProjectRate[]> {
  const { data, error } = await supabase
    .from("project_rates")
    .select("id,project_id,role_id,rate_per_hour,currency")
    .eq("project_id", projectId);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    role_id: r.role_id,
    rate_per_hour: Number(r.rate_per_hour),
    currency: r.currency ?? "SEK",
  }));
}

export async function createProjectRate(
  projectId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
): Promise<ProjectRate> {
  const { data, error } = await supabase
    .from("project_rates")
    .insert({
      project_id: projectId,
      role_id: roleId,
      rate_per_hour: ratePerHour,
      currency,
    })
    .select("id,project_id,role_id,rate_per_hour,currency")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    project_id: data.project_id,
    role_id: data.role_id,
    rate_per_hour: Number(data.rate_per_hour),
    currency: data.currency ?? "SEK",
  };
}

export async function updateProjectRate(
  id: string,
  ratePerHour: number
): Promise<ProjectRate> {
  const { data, error } = await supabase
    .from("project_rates")
    .update({ rate_per_hour: ratePerHour })
    .eq("id", id)
    .select("id,project_id,role_id,rate_per_hour,currency")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    project_id: data.project_id,
    role_id: data.role_id,
    rate_per_hour: Number(data.rate_per_hour),
    currency: data.currency ?? "SEK",
  };
}

export async function deleteProjectRate(id: string): Promise<void> {
  const { error } = await supabase.from("project_rates").delete().eq("id", id);

  if (error) throw error;
}

/** Role IDs that have a rate on this project (project_rates) or on the project's customer (customer_rates). */
async function getRoleIdsWithRateForAllocation(
  projectId: string,
  customerId: string
): Promise<string[]> {
  const [projectRates, customerRates] = await Promise.all([
    supabase
      .from("project_rates")
      .select("role_id")
      .eq("project_id", projectId)
      .then(({ data }) => (data ?? []).map((r) => r.role_id)),
    supabase
      .from("customer_rates")
      .select("role_id")
      .eq("customer_id", customerId)
      .then(({ data }) => (data ?? []).map((r) => r.role_id)),
  ]);
  return [...new Set([...projectRates, ...customerRates])];
}

/** Roles that have a rate for this project (project or customer). For Add Allocation role dropdown; each role once. */
export async function getRolesWithRateForAllocation(
  projectId: string,
  customerId: string
): Promise<{ id: string; name: string }[]> {
  const roleIds = await getRoleIdsWithRateForAllocation(projectId, customerId);
  if (roleIds.length === 0) return [];

  const { data, error } = await supabase
    .from("roles")
    .select("id,name")
    .in("id", roleIds)
    .order("name");

  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }));
}
