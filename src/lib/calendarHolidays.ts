import { supabase } from "./supabaseClient";

export type CalendarHoliday = {
  id: string;
  calendar_id: string;
  holiday_date: string;
  name: string;
};

export async function getCalendarHolidays(
  calendarId: string
): Promise<CalendarHoliday[]> {
  const { data, error } = await supabase
    .from("calendar_holidays")
    .select("id,calendar_id,holiday_date,name")
    .eq("calendar_id", calendarId)
    .order("holiday_date");

  if (error) throw error;

  return (data ?? []).map((h) => ({
    id: h.id,
    calendar_id: h.calendar_id,
    holiday_date: h.holiday_date,
    name: h.name,
  }));
}

/** Fetch holidays for multiple calendars in one query. Returns a map calendar_id -> holidays. */
export async function getCalendarHolidaysByCalendarIds(
  calendarIds: string[]
): Promise<Map<string, CalendarHoliday[]>> {
  if (calendarIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("calendar_holidays")
    .select("id,calendar_id,holiday_date,name")
    .in("calendar_id", calendarIds)
    .order("holiday_date");

  if (error) throw error;

  const byCalendar = new Map<string, CalendarHoliday[]>();
  for (const h of data ?? []) {
    const row = {
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

/** Returns true if the calendar has any holiday falling within the given date range (inclusive). */
export function hasHolidayInRange(
  holidays: CalendarHoliday[],
  dateFrom: string,
  dateTo: string
): boolean {
  return holidays.some(
    (h) => h.holiday_date >= dateFrom && h.holiday_date <= dateTo
  );
}

/** Returns the number of holidays falling within the given date range (inclusive). */
export function countHolidaysInRange(
  holidays: CalendarHoliday[],
  dateFrom: string,
  dateTo: string
): number {
  return holidays.filter(
    (h) => h.holiday_date >= dateFrom && h.holiday_date <= dateTo
  ).length;
}

/** Day of week from YYYY-MM-DD: 0=Sunday, 1=Monday, ..., 6=Saturday. */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** Returns the number of holidays in the range that fall on a weekday (Mon–Fri). Weekend holidays are not subtracted from available hours. */
export function countWeekdayHolidaysInRange(
  holidays: CalendarHoliday[],
  dateFrom: string,
  dateTo: string
): number {
  return holidays.filter((h) => {
    if (h.holiday_date < dateFrom || h.holiday_date > dateTo) return false;
    const day = getDayOfWeek(h.holiday_date);
    return day >= 1 && day <= 5; // Monday=1 .. Friday=5
  }).length;
}

export async function createCalendarHoliday(
  calendarId: string,
  holidayDate: string,
  name: string
): Promise<CalendarHoliday> {
  const { data, error } = await supabase
    .from("calendar_holidays")
    .insert({
      calendar_id: calendarId,
      holiday_date: holidayDate.trim(),
      name: name.trim(),
    })
    .select("id,calendar_id,holiday_date,name")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    calendar_id: data.calendar_id,
    holiday_date: data.holiday_date,
    name: data.name,
  };
}

export async function deleteCalendarHoliday(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_holidays")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
