import { cloudSqlPool } from "@/lib/cloudSqlPool";

import type { CalendarHoliday } from "./calendarHolidaysUtils";

export async function fetchCalendarHolidays(
  calendarId: string
): Promise<CalendarHoliday[]> {
  const { rows } = await cloudSqlPool.query<CalendarHoliday>(
    `SELECT id, calendar_id, holiday_date::text AS holiday_date, name
     FROM calendar_holidays
     WHERE calendar_id = $1
     ORDER BY holiday_date`,
    [calendarId]
  );
  return rows.map((h) => ({
    id: h.id,
    calendar_id: h.calendar_id,
    holiday_date: h.holiday_date,
    name: h.name,
  }));
}

export async function fetchCalendarHolidaysByCalendarIds(
  calendarIds: string[]
): Promise<Map<string, CalendarHoliday[]>> {
  if (calendarIds.length === 0) return new Map();

  const { rows } = await cloudSqlPool.query<CalendarHoliday>(
    `SELECT id, calendar_id, holiday_date::text AS holiday_date, name
     FROM calendar_holidays
     WHERE calendar_id = ANY($1::uuid[])
     ORDER BY holiday_date`,
    [calendarIds]
  );

  const byCalendar = new Map<string, CalendarHoliday[]>();
  for (const h of rows) {
    const row: CalendarHoliday = {
      id: h.id,
      calendar_id: h.calendar_id,
      holiday_date: h.holiday_date,
      name: h.name,
    };
    const list = byCalendar.get(h.calendar_id) ?? [];
    list.push(row);
    byCalendar.set(h.calendar_id, list);
  }
  return byCalendar;
}

export async function createCalendarHolidayQuery(
  calendarId: string,
  holidayDate: string,
  name: string
): Promise<CalendarHoliday> {
  const { rows } = await cloudSqlPool.query<CalendarHoliday>(
    `INSERT INTO calendar_holidays (calendar_id, holiday_date, name)
     VALUES ($1, $2::date, $3)
     RETURNING id, calendar_id, holiday_date::text AS holiday_date, name`,
    [calendarId, holidayDate.trim(), name.trim()]
  );
  if (!rows[0]) throw new Error("Failed to create holiday");
  const h = rows[0];
  return {
    id: h.id,
    calendar_id: h.calendar_id,
    holiday_date: h.holiday_date,
    name: h.name,
  };
}

export async function deleteCalendarHolidayQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM calendar_holidays WHERE id = $1`, [
    id,
  ]);
}
