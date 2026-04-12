import "server-only";

import * as q from "./calendarHolidaysQueries";

export type { CalendarHoliday } from "./calendarHolidaysUtils";
export {
  hasHolidayInRange,
  countHolidaysInRange,
  countWeekdayHolidaysInRange,
} from "./calendarHolidaysUtils";

export async function getCalendarHolidays(calendarId: string) {
  return q.fetchCalendarHolidays(calendarId);
}

export async function getCalendarHolidaysByCalendarIds(calendarIds: string[]) {
  return q.fetchCalendarHolidaysByCalendarIds(calendarIds);
}

export async function createCalendarHoliday(
  calendarId: string,
  holidayDate: string,
  name: string
) {
  return q.createCalendarHolidayQuery(calendarId, holidayDate, name);
}

export async function deleteCalendarHoliday(id: string) {
  return q.deleteCalendarHolidayQuery(id);
}
