import { createClient } from "@/lib/supabase/client";
import * as q from "./calendarHolidaysQueries";

export type { CalendarHoliday } from "./calendarHolidaysUtils";
export {
  hasHolidayInRange,
  countHolidaysInRange,
  countWeekdayHolidaysInRange,
} from "./calendarHolidaysUtils";

export async function getCalendarHolidays(calendarId: string) {
  const supabase = createClient();
  return q.fetchCalendarHolidays(supabase, calendarId);
}

export async function createCalendarHoliday(
  calendarId: string,
  holidayDate: string,
  name: string
) {
  const supabase = createClient();
  return q.createCalendarHolidayQuery(supabase, calendarId, holidayDate, name);
}

export async function deleteCalendarHoliday(id: string) {
  const supabase = createClient();
  return q.deleteCalendarHolidayQuery(supabase, id);
}
