import "server-only";

import { getCachedConsultantsRaw } from "./consultantsCache";
import { createClient } from "@/lib/supabase/server";
import { getProjectsWithCustomer } from "./projects";
import { getAllocationsForWeeks } from "./allocations";
import {
  getCalendarHolidaysByCalendarIds,
  countWeekdayHolidaysInRange,
} from "./calendarHolidays";
import type { CalendarHoliday } from "./calendarHolidays";
import { DEFAULT_HOURS_PER_WEEK } from "./constants";
import { getISOWeekDateRange } from "./dateUtils";
import type {
  OccupancyDataPoint,
  OccupancyReportResult,
  OccupancyWeek,
  RoleOccupancyRow,
} from "@/types/occupancyReport";
import type { ProjectType } from "@/types";

export type {
  OccupancyDataPoint,
  OccupancyReportResult,
  OccupancyWeek,
  RoleOccupancyRow,
} from "@/types/occupancyReport";

const HOURS_PER_HOLIDAY = 8;
type ConsultantRaw = Awaited<ReturnType<typeof getCachedConsultantsRaw>>[number];
type AllocationRaw = Awaited<ReturnType<typeof getAllocationsForWeeks>>[number];
type OccupancyBaseData = {
  consultantsRaw: (ConsultantRaw & { calendarHours: number })[];
  allocations: AllocationRaw[];
  holidaysByCalendar: Map<string, CalendarHoliday[]>;
  projectMap: Map<string, { type: ProjectType; probability: number }>;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function weekLabel(year: number, week: number): string {
  const { start } = getISOWeekDateRange(year, week);
  const month = parseInt(start.slice(5, 7), 10);
  return `W${week} ${MONTH_NAMES[month - 1]}`;
}

async function getOccupancyBaseData(
  weeks: { year: number; week: number }[]
): Promise<OccupancyBaseData> {
  const [consultantsRaw, allocations, calendarsRes] = await Promise.all([
    getCachedConsultantsRaw(),
    getAllocationsForWeeks(weeks),
    (async () => {
      const supabase = await createClient();
      return supabase.from("calendars").select("id,hours_per_week");
    })(),
  ]);
  const calendarsData = calendarsRes.data ?? [];
  const calendarMap = new Map<string, number>();
  for (const c of calendarsData as { id: string; hours_per_week?: number }[]) {
    calendarMap.set(c.id, Number(c.hours_per_week) || DEFAULT_HOURS_PER_WEEK);
  }

  const projectIds = [...new Set(allocations.map((a) => a.project_id))];
  const projects =
    projectIds.length > 0
      ? await getProjectsWithCustomer(projectIds)
      : [];
  const projectMap = new Map(
    projects.map((p) => [p.id, { type: p.type, probability: p.probability ?? 100 }])
  );

  const calendarIds = [
    ...new Set(
      consultantsRaw
        .filter((c) => !(c as { is_external?: boolean }).is_external)
        .map((c) => c.calendar_id)
        .filter(Boolean)
    ),
  ];
  const holidaysByCalendar = await getCalendarHolidaysByCalendarIds(calendarIds);

  return {
    consultantsRaw: consultantsRaw.map((c) => ({
      ...c,
      calendarHours: calendarMap.get(c.calendar_id) ?? DEFAULT_HOURS_PER_WEEK,
    })),
    allocations,
    holidaysByCalendar,
    projectMap,
  };
}

function buildOccupancyPointsForFilter(
  weeks: { year: number; week: number }[],
  baseData: OccupancyBaseData,
  roleId: string | null | undefined,
  teamId?: string | null
): OccupancyDataPoint[] {
  const consultantIds = baseData.consultantsRaw
    .filter((c) => !(c as { is_external?: boolean }).is_external)
    .filter((c) => (roleId == null || c.role_id === roleId))
    .filter((c) => (teamId == null || teamId === "" || (c as { team_id?: string | null }).team_id === teamId))
    .map((c) => c.id);
  const consultantIdSet = new Set(consultantIds);

  const availableHoursByWeekByConsultant = new Map<string, number[]>();
  const overheadHoursByWeek = weeks.map(() => 0);
  for (const c of baseData.consultantsRaw) {
    if (!consultantIdSet.has(c.id)) continue;
    const calendarHours = c.calendarHours;
    const workPct =
      Math.max(5, Math.min(100, Number(c.work_percentage) || 100)) / 100;
    const overheadPct =
      Math.max(0, Math.min(100, Number(c.overhead_percentage) ?? 0)) / 100;
    const holidays = baseData.holidaysByCalendar.get(c.calendar_id) ?? [];
    const availableHoursByWeek = weeks.map((w, i) => {
      const { start, end } = getISOWeekDateRange(w.year, w.week);
      const holidayCount = countWeekdayHolidaysInRange(holidays, start, end);
      const baseHours = Math.max(
        0,
        calendarHours - holidayCount * HOURS_PER_HOLIDAY
      );
      const capacityHours = baseHours * workPct;
      const overheadH = capacityHours * overheadPct;
      overheadHoursByWeek[i] = (overheadHoursByWeek[i] ?? 0) + overheadH;
      return capacityHours * (1 - overheadPct);
    });
    availableHoursByWeekByConsultant.set(c.id, availableHoursByWeek);
  }

  const weekIndexByKey = new Map<string, number>();
  weeks.forEach((w, i) => {
    weekIndexByKey.set(`${w.year}-${w.week}`, i);
  });

  const capacityByWeek = weeks.map(() => 0);
  for (const [, avail] of availableHoursByWeekByConsultant) {
    avail.forEach((h, i) => {
      capacityByWeek[i] = (capacityByWeek[i] ?? 0) + h;
    });
  }

  const hoursRawByWeek = weeks.map(() => 0);
  const hoursWeightedByWeek = weeks.map(() => 0);
  const customer100ByWeek = weeks.map(() => 0);
  const leadsByWeek = weeks.map(() => 0);
  const internalByWeek = weeks.map(() => 0);
  const absenceByWeek = weeks.map(() => 0);

  for (const a of baseData.allocations) {
    if (a.consultant_id == null || !consultantIdSet.has(a.consultant_id))
      continue;
    const key = `${a.year}-${a.week}`;
    const idx = weekIndexByKey.get(key);
    if (idx == null) continue;
    const proj = baseData.projectMap.get(a.project_id);
    const type: ProjectType = proj?.type ?? "customer";
    const prob = proj?.probability ?? 100;
    const hours = Number(a.hours);
    const weighted = hours * (prob / 100);

    hoursRawByWeek[idx] += hours;
    hoursWeightedByWeek[idx] += weighted;
    if (type === "customer") {
      if (prob === 100) customer100ByWeek[idx] += hours;
      else leadsByWeek[idx] += hours;
    } else if (type === "internal") internalByWeek[idx] += hours;
    else absenceByWeek[idx] += hours;
  }

  return weeks.map((_, i) => {
    const cap = capacityByWeek[i] ?? 0;
    const overheadH = overheadHoursByWeek[i] ?? 0;
    const raw = hoursRawByWeek[i] ?? 0;
    const weighted = hoursWeightedByWeek[i] ?? 0;
    return {
      capacity: cap,
      overheadHours: overheadH,
      hoursRaw: raw,
      hoursWeighted: weighted,
      customer100Hours: customer100ByWeek[i] ?? 0,
      leadsHours: leadsByWeek[i] ?? 0,
      internalHours: internalByWeek[i] ?? 0,
      absenceHours: absenceByWeek[i] ?? 0,
      occupancyExkl: cap > 0 ? Math.round((raw / cap) * 100) : 0,
      occupancyInkl: cap > 0 ? Math.round((weighted / cap) * 100) : 0,
    };
  });
}

/**
 * Fetches occupancy report data for the given weeks, optionally filtered by role and/or team.
 * Capacity and allocations are limited to consultants matching the filters when set.
 */
export async function getOccupancyReportData(
  weeks: { year: number; week: number }[],
  roleId: string | null | undefined,
  teamId?: string | null
): Promise<OccupancyReportResult> {
  const weeksWithLabel: OccupancyWeek[] = weeks.map((w) => ({
    year: w.year,
    week: w.week,
    label: weekLabel(w.year, w.week),
  }));

  if (weeks.length === 0) {
    return { weeks: weeksWithLabel, points: [] };
  }
  const baseData = await getOccupancyBaseData(weeks);
  const points = buildOccupancyPointsForFilter(weeks, baseData, roleId, teamId);
  return { weeks: weeksWithLabel, points };
}

/**
 * Fetches occupancy per role for the given weeks (e.g. next 10 weeks).
 * Returns one row for "All roles" plus one per role.
 */
export async function getOccupancyByRoleReport(
  weeks: { year: number; week: number }[],
  roles: { id: string; name: string }[]
): Promise<RoleOccupancyRow[]> {
  const weeksWithLabel: OccupancyWeek[] = weeks.map((w) => ({
    year: w.year,
    week: w.week,
    label: weekLabel(w.year, w.week),
  }));
  if (weeks.length === 0) {
    return [
      { roleId: "", roleName: "All roles", weeks: weeksWithLabel, points: [] },
      ...roles.map((r) => ({ roleId: r.id, roleName: r.name, weeks: weeksWithLabel, points: [] })),
    ];
  }
  const baseData = await getOccupancyBaseData(weeks);
  const roleResults = roles.map((r) => ({
    roleId: r.id,
    roleName: r.name,
    weeks: weeksWithLabel,
    points: buildOccupancyPointsForFilter(weeks, baseData, r.id),
  }));
  return [
    {
      roleId: "",
      roleName: "All roles",
      weeks: weeksWithLabel,
      points: buildOccupancyPointsForFilter(weeks, baseData, undefined),
    },
    ...roleResults,
  ];
}
