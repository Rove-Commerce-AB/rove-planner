import "server-only";

import * as q from "./projectRatesQueries";
import { getProjectWithDetailsById } from "./projects";
import { parseBillingCurrency } from "./currency";

export type { ProjectRate } from "./projectRatesQueries";

export async function getProjectRates(projectId: string) {
  return q.fetchProjectRates(projectId);
}

export async function getProjectRatesByProjectIds(
  projectIds: string[],
  opts?: { includeInactive?: boolean }
) {
  return q.fetchProjectRatesByProjectIds(projectIds, opts);
}

export async function getBillingItemsForCustomerAndProject(
  customerId: string,
  projectId?: string | null
) {
  return q.fetchBillingItemsForCustomerAndProject(customerId, projectId);
}

export async function createProjectRate(
  projectId: string,
  input: {
    roleId?: string | null;
    name?: string | null;
    ratePerHour: number;
    currency?: string;
  }
) {
  const project = await getProjectWithDetailsById(projectId);
  const billingCurrency = parseBillingCurrency(
    input.currency ?? project?.billingCurrency
  );
  return q.createProjectRateQuery(projectId, {
    ...input,
    currency: billingCurrency,
  });
}

export async function updateProjectRate(id: string, ratePerHour: number) {
  return q.updateProjectRateQuery(id, ratePerHour);
}

export async function deleteProjectRate(id: string) {
  return q.deleteProjectRateQuery(id);
}

export async function getRolesWithRateForAllocation(
  projectId: string,
  customerId: string
) {
  return q.fetchRolesWithRateForAllocation(projectId, customerId);
}
