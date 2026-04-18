import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { notifyAllocationInserts } from "@/lib/userNotifications";
import { isoWeeksInYear, addWeeksToYearWeek } from "./dateUtils";

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
  hours: string | number;
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

  const { rows } = await cloudSqlPool.query(
    `SELECT id, consultant_id, project_id, hours
     FROM allocations
     WHERE consultant_id = ANY($1::uuid[])
       AND year = $2 AND week = $3`,
    [consultantIds, year, week]
  );

  return rows.map((r: { id: string; consultant_id: string | null; project_id: string; hours: string | number }) => ({
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

  const { rows } = await cloudSqlPool.query(
    `SELECT id, consultant_id, project_id, hours
     FROM allocations WHERE project_id = ANY($1::uuid[])`,
    [projectIds]
  );

  return rows.map((r: { id: string; consultant_id: string | null; project_id: string; hours: string | number }) => ({
    id: r.id,
    consultant_id: r.consultant_id,
    project_id: r.project_id,
    hours: Number(r.hours),
  }));
}

export async function getAllocationsForProjectWithWeeks(
  projectId: string
): Promise<AllocationRecord[]> {
  const { rows } = await cloudSqlPool.query(
    `SELECT id, consultant_id, project_id, role_id, year, week, hours
     FROM allocations WHERE project_id = $1`,
    [projectId]
  );
  return rows.map(mapAllocation);
}

const ALLOCATIONS_PAGE_SIZE = 1000;

async function getAllocationsForOneYear(
  year: number,
  weeksInYear: { year: number; week: number }[]
): Promise<AllocationRecord[]> {
  const minWeek = Math.min(...weeksInYear.map((w) => w.week));
  const maxWeek = Math.max(...weeksInYear.map((w) => w.week));
  const results: AllocationRecord[] = [];
  let offset = 0;
  let pageLen: number;
  do {
    const { rows } = await cloudSqlPool.query(
      `SELECT id, consultant_id, project_id, role_id, year, week, hours
       FROM allocations
       WHERE year = $1 AND week >= $2 AND week <= $3
       ORDER BY year, week, consultant_id, project_id, id
       LIMIT $4 OFFSET $5`,
      [year, minWeek, maxWeek, ALLOCATIONS_PAGE_SIZE, offset]
    );
    pageLen = rows.length;
    results.push(...rows.map(mapAllocation));
    offset += ALLOCATIONS_PAGE_SIZE;
  } while (pageLen === ALLOCATIONS_PAGE_SIZE);
  return results;
}

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
  const weekSet = new Set(weeks.map((w) => `${w.year}-${w.week}`));
  return yearResults.flat().filter((r) => weekSet.has(`${r.year}-${r.week}`));
}

export async function getAllocationsForWeekRange(
  year: number,
  weekFrom: number,
  weekTo: number
): Promise<AllocationRecord[]> {
  if (weekFrom <= weekTo) {
    const { rows } = await cloudSqlPool.query(
      `SELECT id, consultant_id, project_id, role_id, year, week, hours
       FROM allocations
       WHERE year = $1 AND week >= $2 AND week <= $3`,
      [year, weekFrom, weekTo]
    );
    return rows.map(mapAllocation);
  }

  const maxWeek = isoWeeksInYear(year);
  const [r1, r2] = await Promise.all([
    cloudSqlPool.query(
      `SELECT id, consultant_id, project_id, role_id, year, week, hours
       FROM allocations WHERE year = $1 AND week >= $2 AND week <= $3`,
      [year, weekFrom, maxWeek]
    ),
    cloudSqlPool.query(
      `SELECT id, consultant_id, project_id, role_id, year, week, hours
       FROM allocations WHERE year = $1 AND week >= $2 AND week <= $3`,
      [year + 1, 1, weekTo]
    ),
  ]);
  return [...r1.rows.map(mapAllocation), ...r2.rows.map(mapAllocation)];
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
  const { rows } = await cloudSqlPool.query(
    `INSERT INTO allocations (consultant_id, project_id, role_id, year, week, hours)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, consultant_id, project_id, role_id, year, week, hours`,
    [
      input.consultant_id,
      input.project_id,
      input.role_id ?? null,
      input.year,
      input.week,
      input.hours,
    ]
  );
  if (!rows[0]) throw new Error("Failed to create allocation");
  const created = mapAllocation(rows[0] as Parameters<typeof mapAllocation>[0]);
  await notifyAllocationInserts([created]);
  return created;
}

function weekKey(year: number, week: number): string {
  return `${year}-${week}`;
}

async function getExistingAllocationsInRange(
  consultant_id: string | null,
  project_id: string,
  role_id: string | null,
  weeks: { y: number; w: number }[]
): Promise<Map<string, AllocationRecord>> {
  if (weeks.length === 0) return new Map();

  const years = [...new Set(weeks.map((w) => w.y))];

  const { rows } = await cloudSqlPool.query(
    `SELECT id, consultant_id, project_id, role_id, year, week, hours
     FROM allocations
     WHERE project_id = $1
       AND year = ANY($2::int[])
       AND consultant_id IS NOT DISTINCT FROM $3::uuid
       AND role_id IS NOT DISTINCT FROM $4::uuid`,
    [project_id, years, consultant_id, role_id]
  );

  const weekSet = new Set(weeks.map(({ y, w }) => weekKey(y, w)));
  const map = new Map<string, AllocationRecord>();
  for (const r of rows) {
    const rec = mapAllocation(r as Parameters<typeof mapAllocation>[0]);
    const key = weekKey(rec.year, rec.week);
    if (weekSet.has(key)) map.set(key, rec);
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
    const values: unknown[] = [];
    const placeholders = toCreate
      .map((_, i) => {
        const o = i * 6;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`;
      })
      .join(", ");
    for (const { y, w } of toCreate) {
      values.push(
        consultant_id,
        project_id,
        role_id ?? null,
        y,
        w,
        hoursPerWeek
      );
    }
    const { rows } = await cloudSqlPool.query(
      `INSERT INTO allocations (consultant_id, project_id, role_id, year, week, hours)
       VALUES ${placeholders}
       RETURNING id, consultant_id, project_id, role_id, year, week, hours`,
      values
    );
    insertResults = rows.map(mapAllocation);
  }

  if (insertResults.length > 0) {
    await notifyAllocationInserts(insertResults);
  }

  const byKey = new Map<string, AllocationRecord>();
  for (const r of updateResults) byKey.set(weekKey(r.year, r.week), r);
  for (const r of insertResults) byKey.set(weekKey(r.year, r.week), r);

  return weeks.map(({ y, w }) => byKey.get(weekKey(y, w))!);
}

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
    const values: unknown[] = [];
    const placeholders = toCreate
      .map((_, i) => {
        const o = i * 6;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`;
      })
      .join(", ");
    for (const { y, w, hours } of toCreate) {
      values.push(consultant_id, project_id, role_id ?? null, y, w, hours);
    }
    const { rows } = await cloudSqlPool.query(
      `INSERT INTO allocations (consultant_id, project_id, role_id, year, week, hours)
       VALUES ${placeholders}
       RETURNING id, consultant_id, project_id, role_id, year, week, hours`,
      values
    );
    insertResults = rows.map(mapAllocation);
  }

  if (insertResults.length > 0) {
    await notifyAllocationInserts(insertResults);
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
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.role_id !== undefined) {
    updates.push(`role_id = $${i++}`);
    values.push(input.role_id);
  }
  if (input.hours !== undefined) {
    updates.push(`hours = $${i++}`);
    values.push(input.hours);
  }
  if (updates.length === 0) {
    const { rows } = await cloudSqlPool.query(
      `SELECT id, consultant_id, project_id, role_id, year, week, hours
       FROM allocations WHERE id = $1`,
      [id]
    );
    if (!rows[0]) throw new Error("Allocation not found");
    return mapAllocation(rows[0] as Parameters<typeof mapAllocation>[0]);
  }
  values.push(id);
  const { rows } = await cloudSqlPool.query(
    `UPDATE allocations SET ${updates.join(", ")} WHERE id = $${i}
     RETURNING id, consultant_id, project_id, role_id, year, week, hours`,
    values
  );
  if (!rows[0]) throw new Error("Failed to update allocation");
  return mapAllocation(rows[0] as Parameters<typeof mapAllocation>[0]);
}

export async function deleteAllocation(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM allocations WHERE id = $1`, [id]);
}

export async function deleteAllocations(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await cloudSqlPool.query(`DELETE FROM allocations WHERE id = ANY($1::uuid[])`, [
    ids,
  ]);
}

export async function deleteAllocationsByProjectId(
  projectId: string
): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM allocations WHERE project_id = $1`, [
    projectId,
  ]);
}

export async function moveAllocationsForProject(
  projectId: string,
  deltaWeeks: number
): Promise<{ moved: number }> {
  if (deltaWeeks === 0) return { moved: 0 };
  const rows = await getAllocationsForProjectWithWeeks(projectId);
  if (rows.length === 0) return { moved: 0 };

  type Key = string;
  const groupKey = (
    c: string | null,
    r: string | null,
    y: number,
    w: number
  ): Key => `${c ?? ""}|${r ?? ""}|${y}|${w}`;
  const grouped = new Map<
    Key,
    {
      consultant_id: string | null;
      role_id: string | null;
      year: number;
      week: number;
      hours: number;
    }
  >();
  for (const a of rows) {
    const { year: newYear, week: newWeek } = addWeeksToYearWeek(
      a.year,
      a.week,
      deltaWeeks
    );
    const key = groupKey(a.consultant_id, a.role_id, newYear, newWeek);
    const existing = grouped.get(key);
    const hours = Number(a.hours);
    if (existing) {
      existing.hours += hours;
    } else {
      grouped.set(key, {
        consultant_id: a.consultant_id,
        role_id: a.role_id,
        year: newYear,
        week: newWeek,
        hours,
      });
    }
  }

  await deleteAllocationsByProjectId(projectId);
  const toInsert = Array.from(grouped.values()).map((g) => ({
    consultant_id: g.consultant_id,
    project_id: projectId,
    role_id: g.role_id,
    year: g.year,
    week: g.week,
    hours: g.hours,
  }));
  if (toInsert.length === 0) return { moved: 0 };
  const BATCH = 100;
  for (let j = 0; j < toInsert.length; j += BATCH) {
    const batch = toInsert.slice(j, j + BATCH);
    const values: unknown[] = [];
    const placeholders = batch
      .map((_, idx) => {
        const o = idx * 6;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`;
      })
      .join(", ");
    for (const row of batch) {
      values.push(
        row.consultant_id,
        row.project_id,
        row.role_id,
        row.year,
        row.week,
        row.hours
      );
    }
    await cloudSqlPool.query(
      `INSERT INTO allocations (consultant_id, project_id, role_id, year, week, hours)
       VALUES ${placeholders}`,
      values
    );
  }
  return { moved: toInsert.length };
}
