import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./calendarsQueries";

export type { Calendar, CreateCalendarInput } from "./calendarsQueries";

export async function getCalendars() {
  const supabase = await createClient();
  return q.fetchCalendars(supabase);
}

export async function getCalendarsWithHolidayCount() {
  const supabase = await createClient();
  return q.fetchCalendarsWithHolidayCount(supabase);
}

export async function createCalendar(input: q.CreateCalendarInput) {
  const supabase = await createClient();
  return q.createCalendarQuery(supabase, input);
}

export async function updateCalendar(
  id: string,
  input: { name?: string; country_code?: string; hours_per_week?: number }
) {
  const supabase = await createClient();
  return q.updateCalendarQuery(supabase, id, input);
}

export async function deleteCalendar(id: string) {
  const supabase = await createClient();
  return q.deleteCalendarQuery(supabase, id);
}
