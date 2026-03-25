import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./allocationsQueries";

export type AllocationRecord = q.AllocationRecord;
export type CreateAllocationInput = q.CreateAllocationInput;
export type UpdateAllocationInput = q.UpdateAllocationInput;

export async function getAllocationsForWeek(
  consultantIds: string[],
  year: number,
  week: number
) {
  const supabase = await createClient();
  return q.getAllocationsForWeek(supabase, consultantIds, year, week);
}

export async function getAllocationsByProjectIds(projectIds: string[]) {
  const supabase = await createClient();
  return q.getAllocationsByProjectIds(supabase, projectIds);
}

export async function getAllocationsForProjectWithWeeks(projectId: string) {
  const supabase = await createClient();
  return q.getAllocationsForProjectWithWeeks(supabase, projectId);
}

export async function getAllocationsForWeeks(weeks: { year: number; week: number }[]) {
  const supabase = await createClient();
  return q.getAllocationsForWeeks(supabase, weeks);
}

export async function getAllocationsForWeekRange(
  year: number,
  weekFrom: number,
  weekTo: number
) {
  const supabase = await createClient();
  return q.getAllocationsForWeekRange(supabase, year, weekFrom, weekTo);
}

export async function createAllocation(input: q.CreateAllocationInput) {
  const supabase = await createClient();
  return q.createAllocation(supabase, input);
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
  const supabase = await createClient();
  return q.createAllocationsForWeekRange(
    supabase,
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
  const supabase = await createClient();
  return q.createAllocationsForWeekRangeWithGetter(
    supabase,
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
  const supabase = await createClient();
  return q.updateAllocation(supabase, id, input);
}

export async function deleteAllocation(id: string) {
  const supabase = await createClient();
  return q.deleteAllocation(supabase, id);
}

export async function deleteAllocations(ids: string[]) {
  const supabase = await createClient();
  return q.deleteAllocations(supabase, ids);
}

export async function deleteAllocationsByProjectId(projectId: string) {
  const supabase = await createClient();
  return q.deleteAllocationsByProjectId(supabase, projectId);
}

export async function moveAllocationsForProject(
  projectId: string,
  deltaWeeks: number
) {
  const supabase = await createClient();
  return q.moveAllocationsForProject(supabase, projectId, deltaWeeks);
}
