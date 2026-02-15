import { supabase } from "./supabaseClient";
import { isoWeeksInYear } from "./dateUtils";

export type AllocationRecord = {
  id: string;
  consultant_id: string | null;
  project_id: string;
  role_id: string | null;
  year: number;
  week: number;
  hours: number;
};

function mapAllocation(r: {
  id: string;
  consultant_id: string | null;
  project_id: string;
  role_id: string | null;
  year: number;
  week: number;
  hours: number;
}): AllocationRecord {
  return {
    id: r.id,
    consultant_id: r.consultant_id ?? null,
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

const ALLOCATIONS_PAGE_SIZE = 1000;

async function getAllocationsForOneYear(
  year: number,
  weeksInYear: { year: number; week: number }[]
): Promise<AllocationRecord[]> {
  const minWeek = Math.min(...weeksInYear.map((w) => w.week));
  const maxWeek = Math.max(...weeksInYear.map((w) => w.week));
  const orderOpts = { ascending: true } as const;
  const results: AllocationRecord[] = [];
  let offset = 0;
  let page: unknown[];
  do {
    const { data, error } = await supabase
      .from("allocations")
      .select("id,consultant_id,project_id,role_id,year,week,hours")
      .eq("year", year)
      .gte("week", minWeek)
      .lte("week", maxWeek)
      .order("year", orderOpts)
      .order("week", orderOpts)
      .order("consultant_id", orderOpts)
      .order("project_id", orderOpts)
      .order("id", orderOpts)
      .range(offset, offset + ALLOCATIONS_PAGE_SIZE - 1);
    if (error) throw error;
    page = data ?? [];
    results.push(...(page as Parameters<typeof mapAllocation>[0][]).map(mapAllocation));
    offset += ALLOCATIONS_PAGE_SIZE;
  } while (page.length === ALLOCATIONS_PAGE_SIZE);
  return results;
}

/** Fetches allocations for exactly the (year, week) pairs in `weeks`. Paginates per year to avoid PostgREST 1000-row default limit. Years are fetched in parallel. */
export async function getAllocationsForWeeks(
  weeks: { year: number; week: number }[]
): Promise<AllocationRecord[]> {
  if (weeks.length === 0) return [];
  const uniqueYears = [...new Set(weeks.map((w) => w.year))].sort((a, b) => a - b);
  const yearResults = await Promise.all(
    uniqueYears.map((y) =>
      getAllocationsForOneYear(y, weeks.filter((w) => w.year === y))
    )
  );
  return yearResults.flat();
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

  const maxWeek = isoWeeksInYear(year);
  const [data1, data2] = await Promise.all([
    supabase
      .from("allocations")
      .select("id,consultant_id,project_id,role_id,year,week,hours")
      .eq("year", year)
      .gte("week", weekFrom)
      .lte("week", maxWeek),
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
  consultant_id: string | null;
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
      consultant_id: input.consultant_id ?? null,
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

function weekKey(year: number, week: number): string {
  return `${year}-${week}`;
}

/** Fetch all existing allocations for (consultant, project, role) in the given week list (one query). consultant_id null = "To plan". */
async function getExistingAllocationsInRange(
  consultant_id: string | null,
  project_id: string,
  role_id: string | null,
  weeks: { y: number; w: number }[]
): Promise<Map<string, AllocationRecord>> {
  if (weeks.length === 0) return new Map();

  const years = [...new Set(weeks.map((w) => w.y))];
  let query = supabase
    .from("allocations")
    .select("id,consultant_id,project_id,role_id,year,week,hours")
    .eq("project_id", project_id)
    .in("year", years);

  if (consultant_id === null) {
    query = query.is("consultant_id", null);
  } else {
    query = query.eq("consultant_id", consultant_id);
  }

  if (role_id === null) {
    query = query.is("role_id", null);
  } else {
    query = query.eq("role_id", role_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  const weekSet = new Set(weeks.map(({ y, w }) => weekKey(y, w)));
  const map = new Map<string, AllocationRecord>();
  for (const r of data ?? []) {
    const key = weekKey(r.year, r.week);
    if (weekSet.has(key)) map.set(key, mapAllocation(r));
  }
  return map;
}

export async function createAllocationsForWeekRange(
  consultant_id: string | null,
  project_id: string,
  role_id: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  hoursPerWeek: number
): Promise<AllocationRecord[]> {
  const weeks: { y: number; w: number }[] = [];
  if (weekFrom <= weekTo) {
    for (let w = weekFrom; w <= weekTo; w++) weeks.push({ y: year, w });
  } else {
    for (let w = weekFrom; w <= 52; w++) weeks.push({ y: year, w });
    for (let w = 1; w <= weekTo; w++) weeks.push({ y: year + 1, w });
  }

  const existingMap = await getExistingAllocationsInRange(
    consultant_id,
    project_id,
    role_id,
    weeks
  );

  const toUpdate: { existing: AllocationRecord; newHours: number }[] = [];
  const toCreate: { y: number; w: number }[] = [];

  for (const { y, w } of weeks) {
    const key = weekKey(y, w);
    const existing = existingMap.get(key);
    if (existing) {
      toUpdate.push({ existing, newHours: existing.hours + hoursPerWeek });
    } else {
      toCreate.push({ y, w });
    }
  }

  const updateResults =
    toUpdate.length > 0
      ? await Promise.all(
          toUpdate.map(({ existing, newHours }) =>
            updateAllocation(existing.id, { hours: newHours })
          )
        )
      : [];

  let insertResults: AllocationRecord[] = [];
  if (toCreate.length > 0) {
    const { data, error } = await supabase
      .from("allocations")
      .insert(
        toCreate.map(({ y, w }) => ({
          consultant_id,
          project_id,
          role_id: role_id ?? null,
          year: y,
          week: w,
          hours: hoursPerWeek,
        }))
      )
      .select("id,consultant_id,project_id,role_id,year,week,hours");

    if (error) throw error;
    insertResults = (data ?? []).map(mapAllocation);
  }

  const byKey = new Map<string, AllocationRecord>();
  for (const r of updateResults) byKey.set(weekKey(r.year, r.week), r);
  for (const r of insertResults) byKey.set(weekKey(r.year, r.week), r);

  return weeks.map(({ y, w }) => byKey.get(weekKey(y, w))!);
}

/**
 * Create or update allocations for a week range using a getter for hours per week
 * (e.g. for %-based allocation: hours = percent/100 * availableHoursForWeek).
 */
export async function createAllocationsForWeekRangeWithGetter(
  consultant_id: string | null,
  project_id: string,
  role_id: string | null,
  year: number,
  weekFrom: number,
  weekTo: number,
  getHoursForWeek: (y: number, w: number) => Promise<number>
): Promise<AllocationRecord[]> {
  const weeks: { y: number; w: number }[] = [];
  if (weekFrom <= weekTo) {
    for (let w = weekFrom; w <= weekTo; w++) weeks.push({ y: year, w });
  } else {
    for (let w = weekFrom; w <= 52; w++) weeks.push({ y: year, w });
    for (let w = 1; w <= weekTo; w++) weeks.push({ y: year + 1, w });
  }

  const [existingMap, hoursByWeek] = await Promise.all([
    getExistingAllocationsInRange(consultant_id, project_id, role_id, weeks),
    Promise.all(
      weeks.map(async ({ y, w }) => ({ y, w, hours: await getHoursForWeek(y, w) }))
    ),
  ]);

  const hoursMap = new Map(hoursByWeek.map((h) => [weekKey(h.y, h.w), h.hours]));

  const toUpdate: { existing: AllocationRecord; newHours: number }[] = [];
  const toCreate: { y: number; w: number; hours: number }[] = [];

  for (const { y, w } of weeks) {
    const key = weekKey(y, w);
    const hours = hoursMap.get(key) ?? 0;
    const existing = existingMap.get(key);
    if (existing) {
      toUpdate.push({ existing, newHours: existing.hours + hours });
    } else {
      toCreate.push({ y, w, hours });
    }
  }

  const updateResults =
    toUpdate.length > 0
      ? await Promise.all(
          toUpdate.map(({ existing, newHours }) =>
            updateAllocation(existing.id, { hours: newHours })
          )
        )
      : [];

  let insertResults: AllocationRecord[] = [];
  if (toCreate.length > 0) {
    const { data, error } = await supabase
      .from("allocations")
      .insert(
        toCreate.map(({ y, w, hours }) => ({
          consultant_id,
          project_id,
          role_id: role_id ?? null,
          year: y,
          week: w,
          hours,
        }))
      )
      .select("id,consultant_id,project_id,role_id,year,week,hours");

    if (error) throw error;
    insertResults = (data ?? []).map(mapAllocation);
  }

  const byKey = new Map<string, AllocationRecord>();
  for (const r of updateResults) byKey.set(weekKey(r.year, r.week), r);
  for (const r of insertResults) byKey.set(weekKey(r.year, r.week), r);

  return weeks.map(({ y, w }) => byKey.get(weekKey(y, w))!);
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

/** Delete multiple allocations by id. */
export async function deleteAllocations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("allocations").delete().in("id", ids);
  if (error) throw error;
}
