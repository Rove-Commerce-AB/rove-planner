import { supabase } from "./supabaseClient";
import { getRoles } from "./roles";
import { getCalendars } from "./calendars";
import { getTeams } from "./teams";
import { getAllocationsForWeek } from "./allocations";
import { getProjectsByIds } from "./projects";
import type { ConsultantWithDetails } from "@/types";

export type CreateConsultantInput = {
  name: string;
  email?: string | null;
  role_id: string;
  calendar_id: string;
  team_id?: string | null;
  is_external?: boolean;
  work_percentage?: number;
};

export type UpdateConsultantInput = {
  name?: string;
  email?: string | null;
  role_id?: string;
  calendar_id?: string;
  team_id?: string | null;
  is_external?: boolean;
  work_percentage?: number;
};

export async function createConsultant(
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
    })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function updateConsultant(
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

  const { error } = await supabase
    .from("consultants")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteConsultant(id: string): Promise<void> {
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
};

export async function getConsultantById(
  id: string
): Promise<ConsultantForEdit | null> {
  const { data: c, error } = await supabase
    .from("consultants")
    .select("id,name,email,role_id,calendar_id,team_id,is_external,work_percentage")
    .eq("id", id)
    .single();

  if (error || !c) return null;

  const [roles, calendars, teams] = await Promise.all([
    getRoles(),
    getCalendars(),
    getTeams(),
  ]);
  const roleMap = new Map(roles.map((r) => [r.id, r.name]));
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const calendarMap = new Map(calendars.map((cal) => [cal.id, cal.name]));
  const calendar = calendars.find((cal) => cal.id === c.calendar_id);
  const workPct =
    Math.max(5, Math.min(100, Number(c.work_percentage) ?? 100)) / 100;

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
  };
}

export async function getConsultants(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("consultants")
    .select("id,name")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function getConsultantsWithDetails(
  year: number,
  week: number
): Promise<ConsultantWithDetails[]> {
  const { data: consultantsData, error: consultantsError } = await supabase
    .from("consultants")
    .select("id,name,email,role_id,calendar_id,team_id,is_external,work_percentage")
    .order("name");

  if (consultantsError) throw consultantsError;
  const consultants = consultantsData ?? [];

  if (consultants.length === 0) return [];

  let roles: Awaited<ReturnType<typeof getRoles>> = [];
  let calendars: Awaited<ReturnType<typeof getCalendars>> = [];
  let teams: Awaited<ReturnType<typeof getTeams>> = [];
  let allocations: Awaited<ReturnType<typeof getAllocationsForWeek>> = [];

  try {
    [roles, calendars, teams, allocations] = await Promise.all([
      getRoles(),
      getCalendars(),
      getTeams(),
      getAllocationsForWeek(
        consultants.map((c) => c.id),
        year,
        week
      ),
    ]);
  } catch {
    // Roles, calendars or allocations tables may not exist yet
  }

  const roleMap = new Map(roles.map((r) => [r.id, r.name]));
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const calendarMap = new Map(
    calendars.map((c) => [c.id, { name: c.name, hoursPerWeek: c.hours_per_week }])
  );

  let projectMap = new Map<string, string>();
  try {
    const projectIds = [...new Set(allocations.map((a) => a.project_id))];
    const projects = await getProjectsByIds(projectIds);
    projectMap = new Map(projects.map((p) => [p.id, p.name]));
  } catch {
    // Projects table may not exist
  }

  const allocationsByConsultant = new Map<
    string,
    { projectName: string; hours: number }[]
  >();
  for (const a of allocations) {
    const list = allocationsByConsultant.get(a.consultant_id) ?? [];
    list.push({
      projectName: projectMap.get(a.project_id) ?? "Unknown",
      hours: a.hours,
    });
    allocationsByConsultant.set(a.consultant_id, list);
  }

  return consultants.map((c, i) => {
    const calendar = calendarMap.get(c.calendar_id);
    const calendarHours = calendar?.hoursPerWeek ?? DEFAULT_HOURS_PER_WEEK;
    const workPct = Math.max(5, Math.min(100, Number(c.work_percentage) ?? 100)) / 100;
    const hoursPerWeek = calendarHours * workPct;
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
