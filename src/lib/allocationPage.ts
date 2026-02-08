import { unstable_cache } from "next/cache";
import { getProjectsWithCustomer } from "./projects";
import { getRoles } from "./roles";
import { getTeams } from "./teams";
import { supabase } from "./supabaseClient";
import {
  getAllocationsForWeeks,
  type AllocationRecord,
} from "./allocations";
import {
  getCalendarHolidays,
  countWeekdayHolidaysInRange,
} from "./calendarHolidays";
import { DEFAULT_HOURS_PER_WEEK } from "./constants";
import { getISOWeekDateRange, isoWeeksInYear } from "./dateUtils";

const CACHE_REVALIDATE = 60;

const getCachedRoles = () =>
  unstable_cache(getRoles, ["allocation-roles"], {
    revalidate: CACHE_REVALIDATE,
  })();

const getCachedTeams = () =>
  unstable_cache(getTeams, ["allocation-teams"], {
    revalidate: CACHE_REVALIDATE,
  })();

// Projects (with customer color) fetched without cache so allocation rows
// always reflect the latest customer color.

/** Shared with consultants page so both use the same consultant list. */
export async function getCachedConsultantsRaw() {
  return unstable_cache(
    async () => {
      const { data } = await supabase
        .from("consultants")
        .select("id,name,email,role_id,calendar_id,team_id,is_external,work_percentage,overhead_percentage,start_date,end_date")
        .order("name");
      return data ?? [];
    },
    ["allocation-consultants"],
    { revalidate: CACHE_REVALIDATE, tags: ["allocation-consultants"] }
  )();
}

async function getCachedCalendars() {
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

function getCachedCalendarHolidays(calendarId: string) {
  return unstable_cache(
    () => getCalendarHolidays(calendarId),
    ["allocation-holidays", calendarId],
    { revalidate: CACHE_REVALIDATE }
  )();
}

const HOURS_PER_HOLIDAY = 8;

// Minimal consultant for allocation page
export type AllocationConsultant = {
  id: string;
  name: string;
  initials: string;
  hoursPerWeek: number;
  defaultRoleName: string;
  teamId: string | null;
  teamName: string | null;
  isExternal: boolean;
  /** Available for project allocation per week: capacity (minus holidays × work%) × (1 − overhead%). */
  availableHoursByWeek: number[];
  /** True for each week where consultant is outside start_date/end_date (cell shown gray; bookings still allowed). */
  unavailableByWeek: boolean[];
};

// Project with customer for allocation page
export type AllocationProject = {
  id: string;
  name: string;
  customer_id: string;
  customerName: string;
  customerColor: string;
  isActive?: boolean;
  customerIsActive?: boolean;
};

// Customer for per-customer view
export type AllocationCustomer = {
  id: string;
  name: string;
  color: string;
};

// Single allocation with display info
export type AllocationCell = {
  id: string;
  hours: number;
  roleName: string;
  roleId: string | null;
};

export type AllocationPageData = {
  consultants: AllocationConsultant[];
  projects: AllocationProject[];
  customers: AllocationCustomer[];
  roles: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  allocations: AllocationRecord[];
  year: number;
  weekFrom: number;
  weekTo: number;
  weeks: { year: number; week: number }[];
};

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
  let allocations: AllocationRecord[] = [];

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

    const calendarIds = [...new Set(consultantsRaw.map((c) => c.calendar_id).filter(Boolean))];
    const holidaysByCalendar = new Map<string, Awaited<ReturnType<typeof getCalendarHolidays>>>();
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
      const workPct = Math.max(5, Math.min(100, Number(c.work_percentage) || 100)) / 100;
      const overheadPct = Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
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
        const { start: weekStart, end: weekEnd } = getISOWeekDateRange(w.year, w.week);
        // Gray weeks entirely before start_date (same treatment as after end_date)
        if (startDate && weekEnd < startDate) return true;
        // Gray weeks that extend past end_date (e.g. end 31 Mar → week 31 Mar–6 Apr is gray)
        if (endDate && weekEnd > endDate) return true;
        return false;
      });
      return {
        id: c.id,
        name: c.name,
        initials: getInitials(c.name),
        hoursPerWeek,
        defaultRoleName: roleMap.get(c.role_id) ?? "Unknown",
        teamId: c.team_id ?? null,
        teamName: c.team_id ? teamMap.get(c.team_id) ?? null : null,
        isExternal: c.is_external ?? false,
        availableHoursByWeek,
        unavailableByWeek,
      };
    });

    if (consultantsRaw.length > 0) {
      projects = await getProjectsWithCustomer();
    }
  } catch (e) {
    // Tables may not exist
  }

  const projectIdsWithAllocations = new Set(
    allocations.map((a) => a.project_id)
  );
  const customerMap = new Map<
    string,
    { name: string; color: string }
  >();
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
    roles,
    teams,
    allocations,
    year,
    weekFrom,
    weekTo,
    weeks,
  };
}
