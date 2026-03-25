import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./calendarHolidaysQueries";

export type { CalendarHoliday } from "./calendarHolidaysUtils";
export {
  hasHolidayInRange,
  countHolidaysInRange,
  countWeekdayHolidaysInRange,
} from "./calendarHolidaysUtils";

export async function getCalendarHolidays(calendarId: string) {
  const supabase = await createClient();
  return q.fetchCalendarHolidays(supabase, calendarId);
}

export async function getCalendarHolidaysByCalendarIds(calendarIds: string[]) {
  const supabase = await createClient();
  return q.fetchCalendarHolidaysByCalendarIds(supabase, calendarIds);
}

export async function createCalendarHoliday(
  calendarId: string,
  holidayDate: string,
  name: string
) {
  const supabase = await createClient();
  return q.createCalendarHolidayQuery(supabase, calendarId, holidayDate, name);
}

export async function deleteCalendarHoliday(id: string) {
  const supabase = await createClient();
  return q.deleteCalendarHolidayQuery(supabase, id);
}
