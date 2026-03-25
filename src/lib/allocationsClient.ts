import { createClient } from "@/lib/supabase/client";
import * as q from "./allocationsQueries";

export type AllocationRecord = q.AllocationRecord;
export type CreateAllocationInput = q.CreateAllocationInput;
export type UpdateAllocationInput = q.UpdateAllocationInput;

export async function createAllocation(input: q.CreateAllocationInput) {
  const supabase = createClient();
  return q.createAllocation(supabase, input);
}

export async function updateAllocation(
  id: string,
  input: q.UpdateAllocationInput
) {
  const supabase = createClient();
  return q.updateAllocation(supabase, id, input);
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
  const supabase = createClient();
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
