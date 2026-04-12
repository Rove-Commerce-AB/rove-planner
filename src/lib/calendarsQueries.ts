import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type Calendar = {
  id: string;
  name: string;
  country_code: string;
  hours_per_week: number;
};

export type CreateCalendarInput = {
  name: string;
  country_code: string;
  hours_per_week: number;
};

export async function fetchCalendars(): Promise<Calendar[]> {
  const { rows } = await cloudSqlPool.query<Calendar>(
    `SELECT id, name, country_code, hours_per_week FROM calendars ORDER BY name`
  );
  return rows;
}

export async function fetchCalendarsWithHolidayCount(): Promise<
  (Calendar & { holiday_count: number })[]
> {
  const calendars = await fetchCalendars();
  if (calendars.length === 0) return [];

  let counts: { calendar_id: string }[] = [];
  try {
    const { rows } = await cloudSqlPool.query<{ calendar_id: string }>(
      `SELECT calendar_id FROM calendar_holidays`
    );
    counts = rows;
  } catch {
    // calendar_holidays table may not exist
  }

  const countMap = new Map<string, number>();
  for (const c of counts) {
    countMap.set(c.calendar_id, (countMap.get(c.calendar_id) ?? 0) + 1);
  }

  return calendars.map((c) => ({
    ...c,
    holiday_count: countMap.get(c.id) ?? 0,
  }));
}

export async function createCalendarQuery(
  input: CreateCalendarInput
): Promise<Calendar> {
  const { rows } = await cloudSqlPool.query<Calendar>(
    `INSERT INTO calendars (name, country_code, hours_per_week)
     VALUES ($1, $2, $3)
     RETURNING id, name, country_code, hours_per_week`,
    [
      input.name.trim(),
      input.country_code.trim().toUpperCase().slice(0, 2),
      input.hours_per_week,
    ]
  );
  if (!rows[0]) throw new Error("Failed to create calendar");
  return rows[0];
}

export async function updateCalendarQuery(
  id: string,
  input: { name?: string; country_code?: string; hours_per_week?: number }
): Promise<Calendar> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(input.name.trim());
  }
  if (input.country_code !== undefined) {
    updates.push(`country_code = $${i++}`);
    values.push(input.country_code.trim().toUpperCase().slice(0, 2));
  }
  if (input.hours_per_week !== undefined) {
    updates.push(`hours_per_week = $${i++}`);
    values.push(input.hours_per_week);
  }
  updates.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await cloudSqlPool.query<Calendar>(
    `UPDATE calendars SET ${updates.join(", ")} WHERE id = $${i} RETURNING id, name, country_code, hours_per_week`,
    values
  );
  if (!rows[0]) throw new Error("Failed to update calendar");
  return rows[0];
}

export async function deleteCalendarQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM calendars WHERE id = $1`, [id]);
}
