"use server";

import * as q from "./calendarsQueries";

export type { Calendar, CreateCalendarInput } from "./calendarsQueries";

export async function getCalendars() {
  return q.fetchCalendars();
}

export async function getCalendarsWithHolidayCount() {
  return q.fetchCalendarsWithHolidayCount();
}

export async function createCalendar(input: q.CreateCalendarInput) {
  return q.createCalendarQuery(input);
}

export async function updateCalendar(
  id: string,
  input: { name?: string; country_code?: string; hours_per_week?: number }
) {
  return q.updateCalendarQuery(id, input);
}

export async function deleteCalendar(id: string) {
  return q.deleteCalendarQuery(id);
}
