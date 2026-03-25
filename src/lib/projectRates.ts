import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./projectRatesQueries";

export type { ProjectRate } from "./projectRatesQueries";

export async function getProjectRates(projectId: string) {
  const supabase = await createClient();
  return q.fetchProjectRates(supabase, projectId);
}

export async function createProjectRate(
  projectId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
) {
  const supabase = await createClient();
  return q.createProjectRateQuery(
    supabase,
    projectId,
    roleId,
    ratePerHour,
    currency
  );
}

export async function updateProjectRate(id: string, ratePerHour: number) {
  const supabase = await createClient();
  return q.updateProjectRateQuery(supabase, id, ratePerHour);
}

export async function deleteProjectRate(id: string) {
  const supabase = await createClient();
  return q.deleteProjectRateQuery(supabase, id);
}

export async function getRolesWithRateForAllocation(
  projectId: string,
  customerId: string
) {
  const supabase = await createClient();
  return q.fetchRolesWithRateForAllocation(supabase, projectId, customerId);
}
