import "server-only";

import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser, getAvailableHoursForConsultantWeek } from "@/lib/consultants";
import { getPersonalDashboardData } from "@/lib/dashboard";
import { getCurrentYearWeek, getISOWeekDateStrings } from "@/lib/dateUtils";
import type { AppKey } from "@/lib/peopleTypes";
import { workIssueKey } from "@/lib/workIssueKey";
import { workIssueHref } from "@/lib/routes";
import { getUnreadNotificationCountForCurrentUser } from "@/lib/userNotifications";
import {
  plannerWeekKey,
  type HomeDashboardData,
  type HomePlannerProject,
  type HomePlannerSurface,
  type HomePlannerWeek,
  type HomeTimeReportSurface,
  type HomeWorkIssue,
  type HomeWorkSurface,
} from "@/lib/homeDashboardTypes";

export type {
  HomeDashboardData,
  HomePlannerProject,
  HomePlannerSurface,
  HomePlannerWeek,
  HomeTimeReportSurface,
  HomeWorkIssue,
  HomeWorkSurface,
} from "@/lib/homeDashboardTypes";
export { plannerWeekKey } from "@/lib/homeDashboardTypes";

function firstName(full: string | null | undefined): string | null {
  if (!full?.trim()) return null;
  return full.trim().split(/\s+/)[0] ?? null;
}

async function resolveAppUserId(
  appUser: Awaited<ReturnType<typeof getCurrentAppUser>>
): Promise<string | null> {
  if (appUser?.id) return appUser.id;
  if (!appUser?.email) return null;
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id FROM app_users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [appUser.email]
  );
  return rows[0]?.id ?? null;
}

async function sumReportedHoursForWeek(
  consultantId: string,
  year: number,
  week: number
): Promise<number> {
  const dates = getISOWeekDateStrings(year, week);
  if (dates.length === 0) return 0;
  const { rows } = await cloudSqlPool.query<{ total: string | number }>(
    `SELECT COALESCE(SUM(hours), 0) AS total
     FROM time_report_entries
     WHERE consultant_id = $1
       AND entry_date = ANY($2::date[])`,
    [consultantId, dates]
  );
  return Number(rows[0]?.total ?? 0);
}

async function listOpenWorkIssuesForUser(
  appUserId: string
): Promise<HomeWorkIssue[]> {
  try {
    const { rows } = await cloudSqlPool.query<{
      id: string;
      number: number;
      title: string;
      prefix: string;
      board_title: string;
      customer_id: string;
      project_id: string;
      customer_name: string;
      status_name: string;
    }>(
      `SELECT
         i.id,
         i.number,
         i.title,
         b.prefix,
         b.title AS board_title,
         b.customer_id,
         b.id AS project_id,
         c.name AS customer_name,
         s.name AS status_name
       FROM work_issues i
       INNER JOIN work_projects b ON b.id = i.project_id
       INNER JOIN customers c ON c.id = b.customer_id
       INNER JOIN work_project_statuses s
         ON s.id = i.status AND s.project_id = b.id
       WHERE s.is_done = false
         AND (
           i.owner_app_user_id = $1
           OR EXISTS (
             SELECT 1
             FROM work_issue_assignees a
             WHERE a.issue_id = i.id
               AND a.app_user_id = $1
           )
         )
       ORDER BY i.updated_at DESC NULLS LAST, i.number DESC
       LIMIT 8`,
      [appUserId]
    );
    return rows.map((r) => ({
      id: r.id,
      key: workIssueKey(r.prefix, r.number),
      title: r.title,
      statusName: r.status_name,
      boardTitle: r.board_title,
      customerName: r.customer_name,
      href: workIssueHref(r.customer_id, r.project_id, r.id),
    }));
  } catch (e) {
    console.warn("[homeDashboard] work issues query failed", e);
    return [];
  }
}

/** Personal home surfaces — one per app the user can access. */
export async function getHomeDashboardData(): Promise<HomeDashboardData> {
  const appUser = await getCurrentAppUser();
  const appUserId = await resolveAppUserId(appUser);
  const { year, week } = getCurrentYearWeek();
  const appKeys = (appUser?.appKeys ?? []) as AppKey[];
  const isCustomerUser = appUser?.role === "customer";
  const greetingName = firstName(appUser?.name) ?? firstName(appUser?.email);

  const unreadCount = appUser
    ? await getUnreadNotificationCountForCurrentUser()
    : 0;

  const showPlanner = !isCustomerUser && appKeys.includes("planner");
  const showTimeReport = !isCustomerUser && appKeys.includes("time_report");
  const showWork = appKeys.includes("work");

  const consultant =
    showPlanner || showTimeReport
      ? await getConsultantForCurrentUser()
      : null;

  let planner: HomePlannerSurface | null = null;
  let timeReport: HomeTimeReportSurface | null = null;
  let work: HomeWorkSurface | null = null;

  const personalPromise =
    showPlanner || showTimeReport
      ? getPersonalDashboardData()
      : Promise.resolve(null);

  const availablePromise =
    consultant && (showPlanner || showTimeReport)
      ? getAvailableHoursForConsultantWeek(consultant.id, year, week)
      : Promise.resolve(0);

  const reportedPromise =
    consultant && showTimeReport
      ? sumReportedHoursForWeek(consultant.id, year, week)
      : Promise.resolve(0);

  const workIssuesPromise =
    showWork && appUserId
      ? listOpenWorkIssuesForUser(appUserId)
      : Promise.resolve([] as HomeWorkIssue[]);

  const [personal, availableHours, reportedHours, issues] = await Promise.all([
    personalPromise,
    availablePromise,
    reportedPromise,
    workIssuesPromise,
  ]);

  if (showPlanner) {
    const rows = personal?.rows ?? [];
    const weeks = personal?.weeks ?? [];
    const weekSlice = weeks.slice(0, 6);
    const upcomingWeeks: HomePlannerWeek[] = weekSlice.map((w) => {
      const bookedHours = rows
        .filter((r) => r.year === w.year && r.week === w.week)
        .reduce((s, r) => s + r.hours, 0);
      return {
        year: w.year,
        week: w.week,
        bookedHours,
        availableHours,
      };
    });

    const projectsByWeek: Record<string, HomePlannerProject[]> = {};
    for (const w of weekSlice) {
      const map = new Map<string, HomePlannerProject>();
      for (const r of rows) {
        if (r.year !== w.year || r.week !== w.week) continue;
        const existing = map.get(r.projectId);
        if (existing) {
          existing.hours += r.hours;
        } else {
          map.set(r.projectId, {
            projectId: r.projectId,
            customerName: r.customerName,
            projectName: r.projectName,
            hours: r.hours,
          });
        }
      }
      projectsByWeek[plannerWeekKey(w.year, w.week)] = [...map.values()]
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);
    }

    planner = {
      consultantName: personal?.consultant?.name ?? consultant?.name ?? null,
      currentYear: year,
      currentWeek: week,
      weeks: upcomingWeeks,
      projectsByWeek,
    };
  }

  if (showTimeReport) {
    const plannedHours = (personal?.rows ?? [])
      .filter((r) => r.year === year && r.week === week)
      .reduce((s, r) => s + r.hours, 0);
    timeReport = {
      year,
      week,
      reportedHours,
      plannedHours,
      availableHours,
    };
  }

  if (showWork) {
    work = { issues };
  }

  return {
    greetingName,
    year,
    week,
    unreadCount,
    appKeys,
    isCustomerUser,
    planner,
    timeReport,
    work,
  };
}
