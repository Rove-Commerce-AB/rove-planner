import "server-only";

import * as q from "./allocationsQueries";

export type AllocationRecord = q.AllocationRecord;
export type CreateAllocationInput = q.CreateAllocationInput;
export type UpdateAllocationInput = q.UpdateAllocationInput;

export async function getAllocationsForWeek(
  consultantIds: string[],
  year: number,
  week: number
) {
  return q.getAllocationsForWeek(consultantIds, year, week);
}

export async function getAllocationsByProjectIds(projectIds: string[]) {
  return q.getAllocationsByProjectIds(projectIds);
}

export async function getAllocationsForProjectWithWeeks(projectId: string) {
  return q.getAllocationsForProjectWithWeeks(projectId);
}

export async function getAllocationsForWeeks(
  weeks: { year: number; week: number }[]
) {
  return q.getAllocationsForWeeks(weeks);
}

export async function getAllocationsForWeekRange(
  year: number,
  weekFrom: number,
  weekTo: number
) {
  return q.getAllocationsForWeekRange(year, weekFrom, weekTo);
}

export async function createAllocation(input: q.CreateAllocationInput) {
  return q.createAllocation(input);
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

export async function createAllocationsForWeekRangeWithGetter(
  consultant_id: string | null,
  project_id: string,
  role_id: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  getHoursForWeek: (y: number, w: number) => Promise<number>
) {
  return q.createAllocationsForWeekRangeWithGetter(
    consultant_id,
    project_id,
    role_id,
    year,
    weekFrom,
    weekTo,
    getHoursForWeek
  );
}

export async function updateAllocation(
  id: string,
  input: q.UpdateAllocationInput
) {
  return q.updateAllocation(id, input);
}

export async function deleteAllocation(id: string) {
  return q.deleteAllocation(id);
}

export async function deleteAllocations(ids: string[]) {
  return q.deleteAllocations(ids);
}

export async function deleteAllocationsByProjectId(projectId: string) {
  return q.deleteAllocationsByProjectId(projectId);
}

export async function moveAllocationsForProject(
  projectId: string,
  deltaWeeks: number
) {
  return q.moveAllocationsForProject(projectId, deltaWeeks);
}
