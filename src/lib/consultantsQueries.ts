import type { SupabaseClient } from "@supabase/supabase-js";

import * as allocations from "./allocationsQueries";
import { fetchCalendarHolidays } from "./calendarHolidaysQueries";
import { countWeekdayHolidaysInRange } from "./calendarHolidaysUtils";
import * as calendars from "./calendarsQueries";
import { DEFAULT_HOURS_PER_WEEK } from "./constants";
import { getISOWeekDateRange } from "./dateUtils";
import { fetchProjectsByIds } from "./projectsLookupQueries";
import * as roles from "./rolesQueries";
import * as teams from "./teamsQueries";
import type { ConsultantWithDetails } from "@/types";

const ROVE_CUSTOMER_NAME = "Rove";

export type ConsultantListItem = {
  id: string;
  name: string;
  initials: string;
  teamId: string | null;
  teamName: string | null;
  isExternal: boolean;
  isActive: boolean;
};

export type CreateConsultantInput = {
  name: string;
  email?: string | null;
  role_id: string;
  calendar_id: string;
  team_id?: string | null;
  is_external?: boolean;
  work_percentage?: number;
  overhead_percentage?: number;
  start_date?: string | null;
  end_date?: string | null;
  birth_date?: string | null;
};

export type UpdateConsultantInput = {
  name?: string;
  email?: string | null;
  role_id?: string;
  calendar_id?: string;
  team_id?: string | null;
  is_external?: boolean;
  work_percentage?: number;
  overhead_percentage?: number;
  start_date?: string | null;
  end_date?: string | null;
  birth_date?: string | null;
};

export async function createConsultantQuery(
  supabase: SupabaseClient,
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("consultants")
    .insert({
      name: input.name.trim(),
      email: input.email?.trim() || null,
      role_id: input.role_id,
      calendar_id: input.calendar_id,
      team_id: input.team_id ?? null,
      is_external: input.is_external ?? false,
      work_percentage: input.work_percentage ?? 100,
      overhead_percentage: input.overhead_percentage ?? 0,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      birth_date: input.birth_date ?? null,
    })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function updateConsultantQuery(
  supabase: SupabaseClient,
  id: string,
  input: UpdateConsultantInput
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.email !== undefined)
    updates.email = input.email?.trim() || null;
  if (input.role_id !== undefined) updates.role_id = input.role_id;
  if (input.calendar_id !== undefined) updates.calendar_id = input.calendar_id;
  if (input.team_id !== undefined) updates.team_id = input.team_id ?? null;
  if (input.is_external !== undefined) updates.is_external = input.is_external;
  if (input.work_percentage !== undefined)
    updates.work_percentage = input.work_percentage;
  if (input.overhead_percentage !== undefined)
    updates.overhead_percentage = input.overhead_percentage;
  if (input.start_date !== undefined)
    updates.start_date = input.start_date ?? null;
  if (input.end_date !== undefined) updates.end_date = input.end_date ?? null;
  if (input.birth_date !== undefined)
    updates.birth_date = input.birth_date ?? null;

  const { error } = await supabase
    .from("consultants")
    .update(updates)
    .eq("id", id);

  if (error) throw error;

  // When a consultant becomes external, they should not stay linked to Rove.
  if (input.is_external === true) {
    const { data: roveCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("name", ROVE_CUSTOMER_NAME)
      .maybeSingle();

    if (roveCustomer?.id) {
      const { error: unlinkError } = await supabase
        .from("customer_consultants")
        .delete()
        .eq("customer_id", roveCustomer.id)
        .eq("consultant_id", id);
      if (unlinkError) throw unlinkError;
    }
  }
}

export async function deleteConsultantQuery(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("consultants").delete().eq("id", id);

  if (error) throw error;
}

export type ConsultantForEdit = {
  id: string;
  name: string;
  email: string | null;
  role_id: string;
  roleName: string;
  calendar_id: string;
  calendarName: string;
  team_id: string | null;
  teamName: string | null;
  isExternal: boolean;
  workPercentage: number;
  overheadPercentage: number;
  startDate: string | null;
  endDate: string | null;
  birthDate: string | null;
};

export async function fetchConsultantByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; name: string; calendar_id: string } | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("consultants")
    .select("id,name,calendar_id")
    .eq("email", normalized)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, calendar_id: data.calendar_id };
}

export async function fetchConsultantById(
  supabase: SupabaseClient,
  id: string
): Promise<ConsultantForEdit | null> {
  const { data: c, error } = await supabase
    .from("consultants")
    .select(
      "id,name,email,role_id,calendar_id,team_id,is_external,work_percentage,overhead_percentage,start_date,end_date,birth_date"
    )
    .eq("id", id)
    .single();

  if (error || !c) return null;

  const [rolesData, calendarsData, teamsData] = await Promise.all([
    roles.fetchRoles(supabase),
    calendars.fetchCalendars(supabase),
    teams.fetchTeams(supabase),
  ]);
  const roleMap = new Map(rolesData.map((r) => [r.id, r.name]));
  const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));
  const calendarMap = new Map(calendarsData.map((cal) => [cal.id, cal.name]));
  const workPct =
    Math.max(5, Math.min(100, Number(c.work_percentage) ?? 100)) / 100;
  const overheadPct =
    Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;

  return {
    id: c.id,
    name: c.name,
    email: c.email,
    role_id: c.role_id,
    roleName: roleMap.get(c.role_id) ?? "Unknown",
    calendar_id: c.calendar_id,
    calendarName: calendarMap.get(c.calendar_id) ?? "Unknown",
    team_id: c.team_id ?? null,
    teamName: c.team_id ? teamMap.get(c.team_id) ?? null : null,
    isExternal: c.is_external ?? false,
    workPercentage: Math.round(workPct * 100),
    overheadPercentage: Math.round(overheadPct * 100),
    startDate: c.start_date ?? null,
    endDate: c.end_date ?? null,
    birthDate: c.birth_date ?? null,
  };
}

export async function fetchConsultantsWithDefaultRole(
  supabase: SupabaseClient
): Promise<{ id: string; name: string; role_id: string | null }[]> {
  const { data, error } = await supabase
    .from("consultants")
    .select("id,name,role_id")
    .order("name");

  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    role_id: c.role_id ?? null,
  }));
}

export async function fetchConsultantsList(
  supabase: SupabaseClient
): Promise<ConsultantListItem[]> {
  const { data: rows, error } = await supabase
    .from("consultants")
    .select("id,name,team_id,is_external,end_date")
    .order("name");

  if (error) throw error;
  if (!rows?.length) return [];

  const teamsData = await teams.fetchTeams(supabase);
  const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getInitialsFromName = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return rows.map((r) => {
    const endDate = r.end_date ? new Date(r.end_date) : null;
    const isActive = !endDate || endDate >= today;
    return {
      id: r.id,
      name: r.name,
      initials: getInitialsFromName(r.name),
      teamId: r.team_id ?? null,
      teamName: r.team_id ? teamMap.get(r.team_id) ?? null : null,
      isExternal: r.is_external ?? false,
      isActive,
    };
  });
}

export async function fetchConsultantNamesByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("consultants")
    .select("id,name")
    .in("id", unique);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.id, row.name ?? "");
  }
  return map;
}

export async function fetchAvailableHoursForConsultantWeek(
  supabase: SupabaseClient,
  consultantId: string,
  year: number,
  week: number
): Promise<number> {
  const { data: c, error: cErr } = await supabase
    .from("consultants")
    .select("calendar_id,work_percentage,overhead_percentage")
    .eq("id", consultantId)
    .single();

  if (cErr || !c) return 0;

  const { data: cal, error: calErr } = await supabase
    .from("calendars")
    .select("hours_per_week")
    .eq("id", c.calendar_id)
    .single();

  const hoursPerWeek =
    calErr || !cal
      ? DEFAULT_HOURS_PER_WEEK
      : Number(cal.hours_per_week) || DEFAULT_HOURS_PER_WEEK;
  const workPct =
    Math.max(5, Math.min(100, Number(c.work_percentage) ?? 100)) / 100;
  const overheadPct =
    Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
  const { start, end } = getISOWeekDateRange(year, week);
  const holidays = await fetchCalendarHolidays(supabase, c.calendar_id);
  const weekdayHolidays = countWeekdayHolidaysInRange(holidays, start, end);
  const workingDays = Math.max(0, 5 - weekdayHolidays);
  const capacityHours = (hoursPerWeek * (workingDays / 5)) * workPct;
  return capacityHours * (1 - overheadPct);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function fetchConsultantsWithDetails(
  supabase: SupabaseClient,
  year: number,
  week: number
): Promise<ConsultantWithDetails[]> {
  const { data: rows, error: listErr } = await supabase
    .from("consultants")
    .select(
      "id,name,email,role_id,calendar_id,team_id,is_external,work_percentage,overhead_percentage,start_date,end_date"
    )
    .order("name");
  if (listErr) throw listErr;
  const consultants = rows ?? [];

  if (consultants.length === 0) return [];

  let rolesData: Awaited<ReturnType<typeof roles.fetchRoles>> = [];
  let calendarsData: Awaited<ReturnType<typeof calendars.fetchCalendars>> = [];
  let teamsData: Awaited<ReturnType<typeof teams.fetchTeams>> = [];
  let allocationsData: Awaited<
    ReturnType<typeof allocations.getAllocationsForWeek>
  > = [];

  try {
    [rolesData, calendarsData, teamsData, allocationsData] = await Promise.all([
      roles.fetchRoles(supabase),
      calendars.fetchCalendars(supabase),
      teams.fetchTeams(supabase),
      allocations.getAllocationsForWeek(
        supabase,
        consultants.map((c) => c.id),
        year,
        week
      ),
    ]);
  } catch {
    // Roles, calendars or allocations tables may not exist yet
  }

  const roleMap = new Map(rolesData.map((r) => [r.id, r.name]));
  const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));
  const calendarMap = new Map(
    calendarsData.map((c) => [c.id, { name: c.name, hoursPerWeek: c.hours_per_week }])
  );

  let projectMap = new Map<string, string>();
  try {
    const projectIds = [...new Set(allocationsData.map((a) => a.project_id))];
    const projects = await fetchProjectsByIds(supabase, projectIds);
    projectMap = new Map(projects.map((p) => [p.id, p.name]));
  } catch {
    // Projects table may not exist
  }

  const allocationsByConsultant = new Map<
    string,
    { projectName: string; hours: number }[]
  >();
  for (const a of allocationsData) {
    if (a.consultant_id == null) continue;
    const list = allocationsByConsultant.get(a.consultant_id) ?? [];
    list.push({
      projectName: projectMap.get(a.project_id) ?? "Unknown",
      hours: a.hours,
    });
    allocationsByConsultant.set(a.consultant_id, list);
  }

  return consultants.map((c) => {
    const calendar = calendarMap.get(c.calendar_id);
    const calendarHours = calendar?.hoursPerWeek ?? DEFAULT_HOURS_PER_WEEK;
    const workPct =
      Math.max(5, Math.min(100, Number(c.work_percentage) ?? 100)) / 100;
    const overheadPct =
      Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
    const capacityHoursPerWeek = calendarHours * workPct;
    const hoursPerWeek = capacityHoursPerWeek * (1 - overheadPct);
    const weekAllocations = allocationsByConsultant.get(c.id) ?? [];
    const totalHours = weekAllocations.reduce((sum, a) => sum + a.hours, 0);
    const percent =
      hoursPerWeek > 0 ? Math.round((totalHours / hoursPerWeek) * 100) : 0;

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      role_id: c.role_id,
      roleName: roleMap.get(c.role_id) ?? "Unknown",
      calendar_id: c.calendar_id,
      calendarName: calendar?.name ?? "Unknown",
      team_id: c.team_id ?? null,
      teamName: c.team_id ? teamMap.get(c.team_id) ?? null : null,
      isExternal: c.is_external ?? false,
      workPercentage: Math.round(workPct * 100),
      overheadPercentage: Math.round(overheadPct * 100),
      capacityHoursPerWeek,
      hoursPerWeek,
      initials: getInitials(c.name),
      weekYear: year,
      weekNumber: week,
      totalHoursAllocated: totalHours,
      allocationPercent: percent,
      projectAllocations: weekAllocations,
    };
  });
}
