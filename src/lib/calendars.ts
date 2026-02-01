import { supabase } from "./supabaseClient";

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

export async function getCalendars(): Promise<Calendar[]> {
  const { data, error } = await supabase
    .from("calendars")
    .select("id,name,country_code,hours_per_week")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getCalendarsWithHolidayCount(): Promise<
  (Calendar & { holiday_count: number })[]
> {
  const calendars = await getCalendars();
  if (calendars.length === 0) return [];

  let counts: { calendar_id: string }[] = [];
  try {
    const { data } = await supabase
      .from("calendar_holidays")
      .select("calendar_id");
    counts = data ?? [];
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

export async function createCalendar(
  input: CreateCalendarInput
): Promise<Calendar> {
  const { data, error } = await supabase
    .from("calendars")
    .insert({
      name: input.name.trim(),
      country_code: input.country_code.trim().toUpperCase().slice(0, 2),
      hours_per_week: input.hours_per_week,
    })
    .select("id,name,country_code,hours_per_week")
    .single();

  if (error) throw error;
  return data;
}

export async function updateCalendar(
  id: string,
  input: { name?: string; country_code?: string; hours_per_week?: number }
): Promise<Calendar> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.country_code !== undefined)
    updates.country_code = input.country_code.trim().toUpperCase().slice(0, 2);
  if (input.hours_per_week !== undefined)
    updates.hours_per_week = input.hours_per_week;

  const { data, error } = await supabase
    .from("calendars")
    .update(updates)
    .eq("id", id)
    .select("id,name,country_code,hours_per_week")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCalendar(id: string): Promise<void> {
  const { error } = await supabase.from("calendars").delete().eq("id", id);

  if (error) throw error;
}
