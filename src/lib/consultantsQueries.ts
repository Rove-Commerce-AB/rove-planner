import { cloudSqlPool } from "@/lib/cloudSqlPool";

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
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
    `INSERT INTO consultants (
       name, email, role_id, calendar_id, team_id, is_external,
       work_percentage, overhead_percentage, start_date, end_date, birth_date
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, name`,
    [
      input.name.trim(),
      input.email?.trim() || null,
      input.role_id,
      input.calendar_id,
      input.team_id ?? null,
      input.is_external ?? false,
      input.work_percentage ?? 100,
      input.overhead_percentage ?? 0,
      input.start_date ?? null,
      input.end_date ?? null,
      input.birth_date ?? null,
    ]
  );
  if (!rows[0]) throw new Error("Failed to create consultant");
  return rows[0];
}

export async function updateConsultantQuery(
  id: string,
  input: UpdateConsultantInput
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(input.name.trim());
  }
  if (input.email !== undefined) {
    sets.push(`email = $${i++}`);
    values.push(input.email?.trim() || null);
  }
  if (input.role_id !== undefined) {
    sets.push(`role_id = $${i++}`);
    values.push(input.role_id);
  }
  if (input.calendar_id !== undefined) {
    sets.push(`calendar_id = $${i++}`);
    values.push(input.calendar_id);
  }
  if (input.team_id !== undefined) {
    sets.push(`team_id = $${i++}`);
    values.push(input.team_id ?? null);
  }
  if (input.is_external !== undefined) {
    sets.push(`is_external = $${i++}`);
    values.push(input.is_external);
  }
  if (input.work_percentage !== undefined) {
    sets.push(`work_percentage = $${i++}`);
    values.push(input.work_percentage);
  }
  if (input.overhead_percentage !== undefined) {
    sets.push(`overhead_percentage = $${i++}`);
    values.push(input.overhead_percentage);
  }
  if (input.start_date !== undefined) {
    sets.push(`start_date = $${i++}`);
    values.push(input.start_date ?? null);
  }
  if (input.end_date !== undefined) {
    sets.push(`end_date = $${i++}`);
    values.push(input.end_date ?? null);
  }
  if (input.birth_date !== undefined) {
    sets.push(`birth_date = $${i++}`);
    values.push(input.birth_date ?? null);
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  values.push(id);
  await cloudSqlPool.query(
    `UPDATE consultants SET ${sets.join(", ")} WHERE id = $${i}`,
    values
  );

  if (input.is_external === true) {
    const { rows: roveRows } = await cloudSqlPool.query<{ id: string }>(
      `SELECT id FROM customers WHERE name = $1 LIMIT 1`,
      [ROVE_CUSTOMER_NAME]
    );
    const roveId = roveRows[0]?.id;
    if (roveId) {
      await cloudSqlPool.query(
        `DELETE FROM customer_consultants WHERE customer_id = $1 AND consultant_id = $2`,
        [roveId, id]
      );
    }
  }
}

export async function deleteConsultantQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM consultants WHERE id = $1`, [id]);
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
  email: string
): Promise<{ id: string; name: string; calendar_id: string } | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    calendar_id: string;
  }>(
    `SELECT id, name, calendar_id FROM consultants WHERE lower(email) = $1 LIMIT 1`,
    [normalized]
  );
  return rows[0] ?? null;
}

export async function fetchConsultantById(
  id: string
): Promise<ConsultantForEdit | null> {
  const { rows } = await cloudSqlPool.query(
    `SELECT id, name, email, role_id, calendar_id, team_id, is_external,
            work_percentage, overhead_percentage, start_date::text, end_date::text, birth_date::text
     FROM consultants WHERE id = $1`,
    [id]
  );
  const c = rows[0] as {
    id: string;
    name: string;
    email: string | null;
    role_id: string;
    calendar_id: string;
    team_id: string | null;
    is_external: boolean;
    work_percentage: number;
    overhead_percentage: number;
    start_date: string | null;
    end_date: string | null;
    birth_date: string | null;
  } | undefined;

  if (!c) return null;

  const [rolesData, calendarsData, teamsData] = await Promise.all([
    roles.fetchRoles(),
    calendars.fetchCalendars(),
    teams.fetchTeams(),
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

export async function fetchConsultantsWithDefaultRole(): Promise<
  { id: string; name: string; role_id: string | null }[]
> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    role_id: string | null;
  }>(`SELECT id, name, role_id FROM consultants ORDER BY name`);
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    role_id: c.role_id ?? null,
  }));
}

export async function fetchConsultantsList(): Promise<ConsultantListItem[]> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    team_id: string | null;
    is_external: boolean;
    end_date: string | null;
  }>(
    `SELECT id, name, team_id, is_external, end_date::text AS end_date FROM consultants ORDER BY name`
  );
  if (!rows.length) return [];

  const teamsData = await teams.fetchTeams();
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
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
    `SELECT id, name FROM consultants WHERE id = ANY($1::uuid[])`,
    [unique]
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.id, row.name ?? "");
  }
  return map;
}

export async function fetchAvailableHoursForConsultantWeek(
  consultantId: string,
  year: number,
  week: number
): Promise<number> {
  const { rows: cRows } = await cloudSqlPool.query<{
    calendar_id: string;
    work_percentage: number;
    overhead_percentage: number;
  }>(
    `SELECT calendar_id, work_percentage, overhead_percentage FROM consultants WHERE id = $1`,
    [consultantId]
  );
  const c = cRows[0];
  if (!c) return 0;

  const { rows: calRows } = await cloudSqlPool.query<{ hours_per_week: string | number }>(
    `SELECT hours_per_week FROM calendars WHERE id = $1`,
    [c.calendar_id]
  );
  const cal = calRows[0];

  const hoursPerWeek =
    !cal
      ? DEFAULT_HOURS_PER_WEEK
      : Number(cal.hours_per_week) || DEFAULT_HOURS_PER_WEEK;
  const workPct =
    Math.max(5, Math.min(100, Number(c.work_percentage) ?? 100)) / 100;
  const overheadPct =
    Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
  const { start, end } = getISOWeekDateRange(year, week);
  const holidays = await fetchCalendarHolidays(c.calendar_id);
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
  year: number,
  week: number
): Promise<ConsultantWithDetails[]> {
  const { rows: consultants } = await cloudSqlPool.query(
    `SELECT id, name, email, role_id, calendar_id, team_id, is_external,
            work_percentage, overhead_percentage, start_date::text, end_date::text
     FROM consultants ORDER BY name`
  );
  if (!consultants.length) return [];

  let rolesData: Awaited<ReturnType<typeof roles.fetchRoles>> = [];
  let calendarsData: Awaited<ReturnType<typeof calendars.fetchCalendars>> = [];
  let teamsData: Awaited<ReturnType<typeof teams.fetchTeams>> = [];
  let allocationsData: Awaited<
    ReturnType<typeof allocations.getAllocationsForWeek>
  > = [];

  try {
    [rolesData, calendarsData, teamsData, allocationsData] = await Promise.all([
      roles.fetchRoles(),
      calendars.fetchCalendars(),
      teams.fetchTeams(),
      allocations.getAllocationsForWeek(
        consultants.map((c: { id: string }) => c.id),
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
    const projects = await fetchProjectsByIds(projectIds);
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

  return consultants.map((c: {
    id: string;
    name: string;
    email: string | null;
    role_id: string;
    calendar_id: string;
    team_id: string | null;
    is_external: boolean;
    work_percentage: number;
    overhead_percentage: number;
  }) => {
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
