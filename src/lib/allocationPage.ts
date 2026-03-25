import "server-only";

import { unstable_cache } from "next/cache";

import type {
  AllocationConsultant,
  AllocationCustomer,
  AllocationPageData,
  AllocationProject,
} from "./allocationPageTypes";
import { TO_PLAN_CONSULTANT_ID } from "./allocationPageTypes";
import {
  getAllocationsForWeeks,
  getAllocationsForProjectWithWeeks,
} from "./allocations";
import {
  countWeekdayHolidaysInRange,
  type CalendarHoliday,
} from "./calendarHolidaysUtils";
import { fetchCalendarHolidays } from "./calendarHolidaysQueries";
import * as rolesQueries from "./rolesQueries";
import * as teamsQueries from "./teamsQueries";
import { getCachedConsultantsRaw } from "./consultantsCache";
import { getConsultantsByCustomerId } from "./customerConsultants";
import { DEFAULT_HOURS_PER_WEEK } from "./constants";
import { getISOWeekDateRange, isoWeeksInYear } from "./dateUtils";
import { getProjectsWithCustomer } from "./projects";
import { getRoles } from "./roles";
import { createClient } from "@/lib/supabase/server";
import { getTeams } from "./teams";

const CACHE_REVALIDATE = 60;

async function getCachedRoles() {
  const supabase = await createClient();
  return unstable_cache(
    async () => rolesQueries.fetchRoles(supabase),
    ["allocation-roles"],
    { revalidate: CACHE_REVALIDATE }
  )();
}

async function getCachedTeams() {
  const supabase = await createClient();
  return unstable_cache(
    async () => teamsQueries.fetchTeams(supabase),
    ["allocation-teams"],
    { revalidate: CACHE_REVALIDATE }
  )();
}

async function getCachedCalendars() {
  const supabase = await createClient();
  return unstable_cache(
    async () => {
      const { data } = await supabase
        .from("calendars")
        .select("id,hours_per_week");
      return data ?? [];
    },
    ["allocation-calendars"],
    { revalidate: CACHE_REVALIDATE }
  )();
}

async function getCachedCalendarHolidays(calendarId: string) {
  const supabase = await createClient();
  return unstable_cache(
    async () => fetchCalendarHolidays(supabase, calendarId),
    ["allocation-holidays", calendarId],
    { revalidate: CACHE_REVALIDATE }
  )();
}

const HOURS_PER_HOLIDAY = 8;

export type {
  AllocationCell,
  AllocationConsultant,
  AllocationCustomer,
  AllocationPageData,
  AllocationProject,
} from "./allocationPageTypes";
export { TO_PLAN_CONSULTANT_ID } from "./allocationPageTypes";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function buildWeeksArray(
  year: number,
  weekFrom: number,
  weekTo: number
): { year: number; week: number }[] {
  if (weekFrom <= weekTo) {
    return Array.from({ length: weekTo - weekFrom + 1 }, (_, i) => ({
      year,
      week: weekFrom + i,
    }));
  }
  const weeks: { year: number; week: number }[] = [];
  const maxWeek = isoWeeksInYear(year);
  for (let w = weekFrom; w <= maxWeek; w++) weeks.push({ year, week: w });
  for (let w = 1; w <= weekTo; w++) weeks.push({ year: year + 1, week: w });
  return weeks;
}

/** Fetches allocation page data without cache so add/edit/delete are visible immediately on refresh. */
export async function getAllocationPageData(
  year: number,
  weekFrom: number,
  weekTo: number
): Promise<AllocationPageData> {
  const weeks = buildWeeksArray(year, weekFrom, weekTo);

  let consultants: AllocationConsultant[] = [];
  let projects: AllocationProject[] = [];
  let roles: { id: string; name: string }[] = [];
  let teams: { id: string; name: string }[] = [];
  let allocations: AllocationPageData["allocations"] = [];

  try {
    const [consultantsRaw, rolesData, teamsData, allocationsData, calendarsData] =
      await Promise.all([
        getCachedConsultantsRaw(),
        getCachedRoles(),
        getCachedTeams(),
        getAllocationsForWeeks(weeks),
        getCachedCalendars(),
      ]);

    roles = rolesData;
    teams = teamsData;
    allocations = allocationsData;
    const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));
    const roleMap = new Map(roles.map((r) => [r.id, r.name]));

    const calendarMap = new Map<string, number>();
    for (const c of calendarsData) {
      calendarMap.set(c.id, Number(c.hours_per_week));
    }

    const calendarIds = [
      ...new Set(consultantsRaw.map((c) => c.calendar_id).filter(Boolean)),
    ];
    const holidaysByCalendar = new Map<string, CalendarHoliday[]>();
    await Promise.all(
      calendarIds.map(async (calId) => {
        try {
          const h = await getCachedCalendarHolidays(calId);
          holidaysByCalendar.set(calId, h);
        } catch {
          holidaysByCalendar.set(calId, []);
        }
      })
    );

    consultants = consultantsRaw.map((c) => {
      const calendarHours =
        calendarMap.get(c.calendar_id) ?? DEFAULT_HOURS_PER_WEEK;
      const workPct =
        Math.max(5, Math.min(100, Number(c.work_percentage) || 100)) / 100;
      const overheadPct =
        Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
      const hoursPerWeek = calendarHours * workPct;
      const holidays = holidaysByCalendar.get(c.calendar_id) ?? [];
      const startDate = (c as { start_date?: string | null }).start_date ?? null;
      const endDate = (c as { end_date?: string | null }).end_date ?? null;
      const availableHoursByWeek = weeks.map((w) => {
        const { start, end } = getISOWeekDateRange(w.year, w.week);
        const holidayCount = countWeekdayHolidaysInRange(holidays, start, end);
        const baseHours = Math.max(
          0,
          calendarHours - holidayCount * HOURS_PER_HOLIDAY
        );
        const capacityHours = baseHours * workPct;
        return capacityHours * (1 - overheadPct);
      });
      const unavailableByWeek = weeks.map((w) => {
        const { start: weekStart, end: weekEnd } = getISOWeekDateRange(
          w.year,
          w.week
        );
        if (startDate && weekEnd < startDate) return true;
        if (endDate && weekEnd > endDate) return true;
        return false;
      });
      return {
        id: c.id,
        name: c.name,
        initials: getInitials(c.name),
        hoursPerWeek,
        defaultRoleName: roleMap.get(c.role_id) ?? "Unknown",
        defaultRoleId: c.role_id ?? null,
        teamId: c.team_id ?? null,
        teamName: c.team_id ? teamMap.get(c.team_id) ?? null : null,
        isExternal: c.is_external ?? false,
        availableHoursByWeek,
        unavailableByWeek,
      };
    });

    // Always load projects when building the allocation grid: the UI maps
    // allocations to projects via projectMap — if this stays empty while
    // allocations exist (e.g. consultants list empty due to RLS/cache), all
    // allocation rows would be dropped in the client.
    projects = await getProjectsWithCustomer();

    const toPlanConsultant: AllocationConsultant = {
      id: TO_PLAN_CONSULTANT_ID,
      name: "To plan",
      initials: "TP",
      hoursPerWeek: 0,
      defaultRoleName: "",
      defaultRoleId: null,
      teamId: null,
      teamName: null,
      isExternal: false,
      availableHoursByWeek: weeks.map(() => 0),
      unavailableByWeek: weeks.map(() => false),
    };
    consultants = [toPlanConsultant, ...consultants];
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getAllocationPageData]", e);
    }
  }

  const projectIdsWithAllocations = new Set(
    allocations.map((a) => a.project_id)
  );
  const customerMap = new Map<string, { name: string; color: string }>();
  for (const p of projects) {
    if (projectIdsWithAllocations.has(p.id)) {
      customerMap.set(p.customer_id, {
        name: p.customerName,
        color: p.customerColor,
      });
    }
  }
  const customers: AllocationCustomer[] = Array.from(
    customerMap.entries()
  ).map(([id, { name, color }]) => ({ id, name, color }));

  return {
    consultants,
    projects,
    customers: customers.sort((a, b) => a.name.localeCompare(b.name)),
    roles,
    teams,
    allocations,
    year,
    weekFrom,
    weekTo,
    weeks,
  };
}

const CONSULTANTS_SELECT =
  "id,name,email,role_id,calendar_id,team_id,is_external,work_percentage,overhead_percentage,start_date,end_date";

async function getConsultantsRawByIds(
  ids: string[]
): Promise<Awaited<ReturnType<typeof getCachedConsultantsRaw>>> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("consultants")
    .select(CONSULTANTS_SELECT)
    .in("id", ids)
    .order("name");
  return data ?? [];
}

/** Allocation data scoped to one project and only consultants linked to that project's customer. For project detail planning panel. */
export async function getAllocationPageDataForProject(
  projectId: string,
  customerId: string,
  year: number,
  weekFrom: number,
  weekTo: number
): Promise<AllocationPageData> {
  const weeks = buildWeeksArray(year, weekFrom, weekTo);

  const customerConsultants = await getConsultantsByCustomerId(customerId);
  const consultantIds = customerConsultants.map((c) => c.id);
  const consultantsRaw = await getConsultantsRawByIds(consultantIds);

  const [rolesData, teamsData, allocationsData, calendarsData, projectsAll] =
    await Promise.all([
      getCachedRoles(),
      getCachedTeams(),
      getAllocationsForWeeks(weeks),
      getCachedCalendars(),
      getProjectsWithCustomer(),
    ]);

  const allocations = allocationsData.filter((a) => a.project_id === projectId);
  const projects = projectsAll.filter((p) => p.id === projectId);

  const allProjectAllocations =
    await getAllocationsForProjectWithWeeks(projectId);
  const consultantTotalHours: Record<string, number> = {};
  const seenSlot = new Set<string>();
  for (const a of allProjectAllocations) {
    const slotKey = `${a.consultant_id ?? TO_PLAN_CONSULTANT_ID}-${a.year}-${a.week}-${a.role_id ?? ""}`;
    if (seenSlot.has(slotKey)) continue;
    seenSlot.add(slotKey);
    const consultantKey = a.consultant_id ?? TO_PLAN_CONSULTANT_ID;
    consultantTotalHours[consultantKey] =
      (consultantTotalHours[consultantKey] ?? 0) + a.hours;
  }

  const teamMap = new Map(teamsData.map((t) => [t.id, t.name]));
  const roleMap = new Map(rolesData.map((r) => [r.id, r.name]));

  const calendarMap = new Map<string, number>();
  for (const c of calendarsData) {
    calendarMap.set(c.id, Number(c.hours_per_week));
  }

  const calendarIds = [
    ...new Set(consultantsRaw.map((c) => c.calendar_id).filter(Boolean)),
  ];
  const holidaysByCalendar = new Map<string, CalendarHoliday[]>();
  await Promise.all(
    calendarIds.map(async (calId) => {
      try {
        const h = await getCachedCalendarHolidays(calId);
        holidaysByCalendar.set(calId, h);
      } catch {
        holidaysByCalendar.set(calId, []);
      }
    })
  );

  let consultants: AllocationConsultant[] = consultantsRaw.map((c) => {
    const calendarHours =
      calendarMap.get(c.calendar_id) ?? DEFAULT_HOURS_PER_WEEK;
    const workPct =
      Math.max(5, Math.min(100, Number(c.work_percentage) || 100)) / 100;
    const overheadPct =
      Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
    const hoursPerWeek = calendarHours * workPct;
    const holidays = holidaysByCalendar.get(c.calendar_id) ?? [];
    const startDate = (c as { start_date?: string | null }).start_date ?? null;
    const endDate = (c as { end_date?: string | null }).end_date ?? null;
    const availableHoursByWeek = weeks.map((w) => {
      const { start, end } = getISOWeekDateRange(w.year, w.week);
      const holidayCount = countWeekdayHolidaysInRange(holidays, start, end);
      const baseHours = Math.max(
        0,
        calendarHours - holidayCount * HOURS_PER_HOLIDAY
      );
      const capacityHours = baseHours * workPct;
      return capacityHours * (1 - overheadPct);
    });
    const unavailableByWeek = weeks.map((w) => {
      const { start: weekStart, end: weekEnd } = getISOWeekDateRange(
        w.year,
        w.week
      );
      if (startDate && weekEnd < startDate) return true;
      if (endDate && weekEnd > endDate) return true;
      return false;
    });
    return {
      id: c.id,
      name: c.name,
      initials: getInitials(c.name),
      hoursPerWeek,
      defaultRoleName: roleMap.get(c.role_id) ?? "Unknown",
      defaultRoleId: c.role_id ?? null,
      teamId: c.team_id ?? null,
      teamName: c.team_id ? teamMap.get(c.team_id) ?? null : null,
      isExternal: c.is_external ?? false,
      availableHoursByWeek,
      unavailableByWeek,
    };
  });

  const toPlanConsultant: AllocationConsultant = {
    id: TO_PLAN_CONSULTANT_ID,
    name: "To plan",
    initials: "TP",
    hoursPerWeek: 0,
    defaultRoleName: "",
    defaultRoleId: null,
    teamId: null,
    teamName: null,
    isExternal: false,
    availableHoursByWeek: weeks.map(() => 0),
    unavailableByWeek: weeks.map(() => false),
  };
  consultants = [toPlanConsultant, ...consultants];

  const projectIdsWithAllocations = new Set(allocations.map((a) => a.project_id));
  const customerMap = new Map<string, { name: string; color: string }>();
  for (const p of projects) {
    if (projectIdsWithAllocations.has(p.id)) {
      customerMap.set(p.customer_id, {
        name: p.customerName,
        color: p.customerColor,
      });
    }
  }
  const customers: AllocationCustomer[] = Array.from(customerMap.entries()).map(
    ([id, { name, color }]) => ({ id, name, color })
  );

  return {
    consultants,
    projects,
    customers: customers.sort((a, b) => a.name.localeCompare(b.name)),
    roles: rolesData,
    teams: teamsData,
    allocations,
    year,
    weekFrom,
    weekTo,
    weeks,
    consultantTotalHours,
  };
}
