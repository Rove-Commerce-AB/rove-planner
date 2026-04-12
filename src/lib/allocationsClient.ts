"use server";

import * as q from "./allocationsQueries";

export type AllocationRecord = q.AllocationRecord;
export type CreateAllocationInput = q.CreateAllocationInput;
export type UpdateAllocationInput = q.UpdateAllocationInput;

export async function createAllocation(input: q.CreateAllocationInput) {
  return q.createAllocation(input);
}

export async function updateAllocation(
  id: string,
  input: q.UpdateAllocationInput
) {
  return q.updateAllocation(id, input);
}

export async function createAllocationsForWeekRange(
  consultant_id: string | null,
  project_id: string,
  role_id: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  hoursPerWeek: number
) {
  return q.createAllocationsForWeekRange(
    consultant_id,
    project_id,
    role_id,
    year,
    weekFrom,
    weekTo,
    hoursPerWeek
  );
}
