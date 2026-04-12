"use server";

import * as q from "./projectRatesQueries";

export type { ProjectRate } from "./projectRatesQueries";

export async function getProjectRates(projectId: string) {
  return q.fetchProjectRates(projectId);
}

export async function createProjectRate(
  projectId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
) {
  return q.createProjectRateQuery(
    projectId,
    roleId,
    ratePerHour,
    currency
  );
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
