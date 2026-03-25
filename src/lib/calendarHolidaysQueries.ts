import type { SupabaseClient } from "@supabase/supabase-js";

import type { CalendarHoliday } from "./calendarHolidaysUtils";

export async function fetchCalendarHolidays(
  supabase: SupabaseClient,
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

export async function fetchCalendarHolidaysByCalendarIds(
  supabase: SupabaseClient,
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

export async function createCalendarHolidayQuery(
  supabase: SupabaseClient,
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

export async function deleteCalendarHolidayQuery(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("calendar_holidays")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
