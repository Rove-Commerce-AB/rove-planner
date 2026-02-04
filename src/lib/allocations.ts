import { supabase } from "./supabaseClient";

export type AllocationRecord = {
  id: string;
  consultant_id: string;
  project_id: string;
  role_id: string | null;
  year: number;
  week: number;
  hours: number;
};

function mapAllocation(r: {
  id: string;
  consultant_id: string;
  project_id: string;
  role_id: string | null;
  year: number;
  week: number;
  hours: number;
}): AllocationRecord {
  return {
    id: r.id,
    consultant_id: r.consultant_id,
    project_id: r.project_id,
    role_id: r.role_id ?? null,
    year: r.year,
    week: r.week,
    hours: Number(r.hours),
  };
}

export async function getAllocationsForWeek(
  consultantIds: string[],
  year: number,
  week: number
): Promise<Omit<AllocationRecord, "year" | "week" | "role_id">[]> {
  if (consultantIds.length === 0) return [];

  const { data, error } = await supabase
    .from("allocations")
    .select("id,consultant_id,project_id,hours")
    .in("consultant_id", consultantIds)
    .eq("year", year)
    .eq("week", week);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    consultant_id: r.consultant_id,
    project_id: r.project_id,
    hours: Number(r.hours),
  }));
}

export async function getAllocationsByProjectIds(
  projectIds: string[]
): Promise<Omit<AllocationRecord, "year" | "week" | "role_id">[]> {
  if (projectIds.length === 0) return [];

  const { data, error } = await supabase
    .from("allocations")
    .select("id,consultant_id,project_id,hours")
    .in("project_id", projectIds);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    consultant_id: r.consultant_id,
    project_id: r.project_id,
    hours: Number(r.hours),
  }));
}

export async function getAllocationsForWeekRange(
  year: number,
  weekFrom: number,
  weekTo: number
): Promise<AllocationRecord[]> {
  if (weekFrom <= weekTo) {
    const { data, error } = await supabase
      .from("allocations")
      .select("id,consultant_id,project_id,role_id,year,week,hours")
      .eq("year", year)
      .gte("week", weekFrom)
      .lte("week", weekTo);

    if (error) throw error;

    return (data ?? []).map(mapAllocation);
  }

  const [data1, data2] = await Promise.all([
    supabase
      .from("allocations")
      .select("id,consultant_id,project_id,role_id,year,week,hours")
      .eq("year", year)
      .gte("week", weekFrom)
      .lte("week", 52),
    supabase
      .from("allocations")
      .select("id,consultant_id,project_id,role_id,year,week,hours")
      .eq("year", year + 1)
      .gte("week", 1)
      .lte("week", weekTo),
  ]);

  if (data1.error) throw data1.error;
  if (data2.error) throw data2.error;

  return [
    ...(data1.data ?? []).map(mapAllocation),
    ...(data2.data ?? []).map(mapAllocation),
  ];
}

export type CreateAllocationInput = {
  consultant_id: string;
  project_id: string;
  role_id?: string | null;
  year: number;
  week: number;
  hours: number;
};

export async function createAllocation(
  input: CreateAllocationInput
): Promise<AllocationRecord> {
  const { data, error } = await supabase
    .from("allocations")
    .insert({
      consultant_id: input.consultant_id,
      project_id: input.project_id,
      role_id: input.role_id ?? null,
      year: input.year,
      week: input.week,
      hours: input.hours,
    })
    .select("id,consultant_id,project_id,role_id,year,week,hours")
    .single();

  if (error) throw error;
  return mapAllocation(data);
}

async function findExistingAllocation(
  consultant_id: string,
  project_id: string,
  role_id: string | null,
  year: number,
  week: number
): Promise<AllocationRecord | null> {
  let query = supabase
    .from("allocations")
    .select("id,consultant_id,project_id,role_id,year,week,hours")
    .eq("consultant_id", consultant_id)
    .eq("project_id", project_id)
    .eq("year", year)
    .eq("week", week);

  if (role_id === null) {
    query = query.is("role_id", null);
  } else {
    query = query.eq("role_id", role_id);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data ? mapAllocation(data) : null;
}

export async function createAllocationsForWeekRange(
  consultant_id: string,
  project_id: string,
  role_id: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  hoursPerWeek: number
): Promise<AllocationRecord[]> {
  const results: AllocationRecord[] = [];

  for (let w = weekFrom; w <= weekTo; w++) {
    const existing = await findExistingAllocation(
      consultant_id,
      project_id,
      role_id,
      year,
      w
    );

    if (existing) {
      const newHours = existing.hours + hoursPerWeek;
      const updated = await updateAllocation(existing.id, { hours: newHours });
      results.push(updated);
    } else {
      const created = await createAllocation({
        consultant_id,
        project_id,
        role_id,
        year,
        week: w,
        hours: hoursPerWeek,
      });
      results.push(created);
    }
  }

  return results;
}

/**
 * Create or update allocations for a week range using a getter for hours per week
 * (e.g. for %-based allocation: hours = percent/100 * availableHoursForWeek).
 */
export async function createAllocationsForWeekRangeWithGetter(
  consultant_id: string,
  project_id: string,
  role_id: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  getHoursForWeek: (y: number, w: number) => Promise<number>
): Promise<AllocationRecord[]> {
  const results: AllocationRecord[] = [];
  const weeks: { y: number; w: number }[] = [];

  if (weekFrom <= weekTo) {
    for (let w = weekFrom; w <= weekTo; w++) weeks.push({ y: year, w });
  } else {
    for (let w = weekFrom; w <= 52; w++) weeks.push({ y: year, w });
    for (let w = 1; w <= weekTo; w++) weeks.push({ y: year + 1, w });
  }

  for (const { y, w } of weeks) {
    const hours = await getHoursForWeek(y, w);
    const existing = await findExistingAllocation(
      consultant_id,
      project_id,
      role_id,
      y,
      w
    );
    if (existing) {
      const newHours = existing.hours + hours;
      const updated = await updateAllocation(existing.id, { hours: newHours });
      results.push(updated);
    } else {
      const created = await createAllocation({
        consultant_id,
        project_id,
        role_id,
        year: y,
        week: w,
        hours,
      });
      results.push(created);
    }
  }

  return results;
}

export type UpdateAllocationInput = {
  role_id?: string | null;
  hours?: number;
};

export async function updateAllocation(
  id: string,
  input: UpdateAllocationInput
): Promise<AllocationRecord> {
  const updates: Record<string, unknown> = {};
  if (input.role_id !== undefined) updates.role_id = input.role_id;
  if (input.hours !== undefined) updates.hours = input.hours;

  const { data, error } = await supabase
    .from("allocations")
    .update(updates)
    .eq("id", id)
    .select("id,consultant_id,project_id,role_id,year,week,hours")
    .single();

  if (error) throw error;
  return mapAllocation(data);
}

export async function deleteAllocation(id: string): Promise<void> {
  const { error } = await supabase.from("allocations").delete().eq("id", id);

  if (error) throw error;
}
