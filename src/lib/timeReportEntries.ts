import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getProjectsByCustomerIds } from "@/lib/projects";
import {
  getJiraIssuesByProjectKey,
  getDevOpsWorkItemsByProject,
} from "@/lib/timeReportIntegrations";
import { getCustomerRates } from "@/lib/customerRates";
import { getProjectRates, getRolesWithRateForAllocation } from "@/lib/projectRates";
import { getCalendarHolidays } from "@/lib/calendarHolidays";
import { getISOWeekDateRange, getISOWeekDateStrings } from "@/lib/dateUtils";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getInternalCustomerId } from "@/lib/customers";
import type {
  CopyEntryToWeekResult,
  JiraDevOpsOption,
  ProjectOption,
  SaveTimeReportEntriesResult,
  TaskOption,
  TimeReportCustomerGroup,
  TimeReportEntry,
  TimeReportEntryCopyPayload,
  TimeReportWeekData,
} from "@/types";

async function getTimeReportAccessContext() {
  const [appUser, consultant] = await Promise.all([
    getCurrentAppUser(),
    getConsultantForCurrentUser(),
  ]);
  if (!consultant?.id) {
    return {
      appUser,
      consultant: null,
      allowedCustomerIds: new Set<string>(),
      bookedProjectIds: new Set<string>(),
    };
  }

  const { rows: customerLinks } = await cloudSqlPool.query<{ customer_id: string }>(
    `SELECT customer_id FROM customer_consultants WHERE consultant_id = $1`,
    [consultant.id]
  );
  const allowedCustomerIds = new Set(customerLinks.map((r) => r.customer_id));
  if (isSubcontractorRole(appUser?.role)) {
    const internalCustomerId = await getInternalCustomerId();
    if (internalCustomerId) allowedCustomerIds.delete(internalCustomerId);
  }

  const { rows: allocations } = await cloudSqlPool.query<{ project_id: string }>(
    `SELECT project_id FROM allocations WHERE consultant_id = $1`,
    [consultant.id]
  );
  const bookedProjectIds = new Set(allocations.map((r) => r.project_id));

  return { appUser, consultant, allowedCustomerIds, bookedProjectIds };
}

function isSubcontractorRole(role: string | undefined): boolean {
  return role === "subcontractor";
}

/** When saving month view, only cells and deletes inside this calendar month are applied (ISO weeks may spill outside). */
export type SaveTimeReportCalendarMonthScope = { year: number; month: number };

function calendarMonthDateBounds(y: number, m: number): { start: string; end: string } {
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const monthEnd = new Date(y, m, 0);
  const end = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(
    monthEnd.getDate()
  ).padStart(2, "0")}`;
  return { start, end };
}

function dateStrInInclusiveBounds(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}

export async function getActiveProjectsForCustomer(
  customerId: string
): Promise<ProjectOption[]> {
  if (!customerId) return [];
  const ctx = await getTimeReportAccessContext();
  if (!ctx.consultant) return [];
  if (!ctx.allowedCustomerIds.has(customerId)) return [];

  const projects = await getProjectsByCustomerIds([customerId]);
  const active = projects.filter((p) => p.is_active);
  if (isSubcontractorRole(ctx.appUser?.role)) {
    return active
      .filter((p) => ctx.bookedProjectIds.has(p.id))
      .map((p) => ({ value: p.id, label: p.name }));
  }
  return active.map((p) => ({ value: p.id, label: p.name }));
}

export async function getJiraDevOpsOptionsForProject(
  projectId: string
): Promise<JiraDevOpsOption[]> {
  if (!projectId) return [];
  const ctx = await getTimeReportAccessContext();
  if (!ctx.consultant) return [];
  if (isSubcontractorRole(ctx.appUser?.role) && !ctx.bookedProjectIds.has(projectId)) {
    return [];
  }
  const { rows } = await cloudSqlPool.query<{
    jira_project_key: string | null;
    devops_project: string | null;
  }>(
    `SELECT jira_project_key, devops_project FROM projects WHERE id = $1`,
    [projectId]
  );
  const project = rows[0];
  if (!project) return [];

  const options: JiraDevOpsOption[] = [];
  if (project.jira_project_key) {
    const jira = await getJiraIssuesByProjectKey(project.jira_project_key);
    options.push(
      ...jira.map((o) => ({
        value: `jira:${o.value}`,
        label: o.label,
        url: o.url ?? undefined,
        description: o.summary?.trim() || null,
      }))
    );
  }
  if (project.devops_project) {
    const devops = await getDevOpsWorkItemsByProject(project.devops_project);
    options.push(
      ...devops.map((o) => ({
        value: `devops:${o.value}`,
        label: o.label,
        description: o.title?.trim() || null,
      }))
    );
  }
  return options;
}

export async function getTaskOptionsForCustomerAndProject(
  customerId: string,
  projectId?: string
): Promise<TaskOption[]> {
  if (!customerId) return [];
  const ctx = await getTimeReportAccessContext();
  if (!ctx.consultant) return [];
  if (!ctx.allowedCustomerIds.has(customerId)) return [];
  if (
    isSubcontractorRole(ctx.appUser?.role) &&
    projectId &&
    !ctx.bookedProjectIds.has(projectId)
  ) {
    return [];
  }

  if (projectId) {
    const roles = await getRolesWithRateForAllocation(projectId, customerId);
    return roles.map((r) => ({ value: r.id, label: r.name }));
  }
  const rates = await getCustomerRates(customerId);
  const roleIds = [...new Set(rates.map((r) => r.role_id))];
  if (roleIds.length === 0) return [];
  const { rows: roles } = await cloudSqlPool.query<{ id: string; name: string }>(
    `SELECT id, name FROM roles WHERE id = ANY($1::uuid[]) ORDER BY name`,
    [roleIds]
  );
  return roles.map((r) => ({ value: r.id, label: r.name }));
}

export type TimeReportBatchHydrateResult = {
  projectsByCustomerId: Record<string, ProjectOption[]>;
  tasksByCacheKey: Record<string, TaskOption[]>;
};

/** Aligns with `taskCacheKey` in `timeReportEntryModel.ts`. */
function timeReportTaskCacheKeyServer(customerId: string, projectId: string) {
  return `${customerId}-${projectId || ""}`;
}

/**
 * Single server round-trip for project and role/task dropdown data after loading a week.
 * @param customerIds Customers to load project lists for (e.g. all groups in the week).
 * @param taskOptionPairs Unique (customerId, projectId) pairs; use projectId "" when no project is selected.
 */
export async function batchHydrateTimeReport(
  customerIds: string[],
  taskOptionPairs: Array<{ customerId: string; projectId: string }>
): Promise<TimeReportBatchHydrateResult> {
  const ctx = await getTimeReportAccessContext();
  if (!ctx.consultant) {
    return { projectsByCustomerId: {}, tasksByCacheKey: {} };
  }

  const uniqueCustomers = [
    ...new Set(customerIds.filter((id) => id && ctx.allowedCustomerIds.has(id))),
  ];

  const projectsByCustomerId: Record<string, ProjectOption[]> = {};
  for (const cid of uniqueCustomers) {
    projectsByCustomerId[cid] = [];
  }

  if (uniqueCustomers.length > 0) {
    const projects = await getProjectsByCustomerIds(uniqueCustomers);
    for (const cid of uniqueCustomers) {
      const active = projects.filter((p) => p.customer_id === cid && p.is_active);
      const filtered = isSubcontractorRole(ctx.appUser?.role)
        ? active.filter((p) => ctx.bookedProjectIds.has(p.id))
        : active;
      projectsByCustomerId[cid] = filtered.map((p) => ({
        value: p.id,
        label: p.name,
      }));
    }
  }

  const pairSeen = new Set<string>();
  const uniquePairs: Array<{ customerId: string; projectId: string }> = [];
  for (const pair of taskOptionPairs) {
    if (!pair.customerId || !ctx.allowedCustomerIds.has(pair.customerId)) continue;
    if (
      isSubcontractorRole(ctx.appUser?.role) &&
      pair.projectId &&
      !ctx.bookedProjectIds.has(pair.projectId)
    ) {
      continue;
    }
    const normProjectId = pair.projectId || "";
    const k = `${pair.customerId}|${normProjectId}`;
    if (pairSeen.has(k)) continue;
    pairSeen.add(k);
    uniquePairs.push({ customerId: pair.customerId, projectId: normProjectId });
  }

  const taskEntries = await Promise.all(
    uniquePairs.map(async ({ customerId, projectId }) => {
      const key = timeReportTaskCacheKeyServer(customerId, projectId);
      if (projectId) {
        const roles = await getRolesWithRateForAllocation(projectId, customerId);
        return [key, roles.map((r) => ({ value: r.id, label: r.name }))] as const;
      }
      const rates = await getCustomerRates(customerId);
      const roleIds = [...new Set(rates.map((r) => r.role_id))];
      if (roleIds.length === 0) {
        return [key, [] as TaskOption[]] as const;
      }
      const { rows: roles } = await cloudSqlPool.query<{ id: string; name: string }>(
        `SELECT id, name FROM roles WHERE id = ANY($1::uuid[]) ORDER BY name`,
        [roleIds]
      );
      return [key, roles.map((r) => ({ value: r.id, label: r.name }))] as const;
    })
  );

  const tasksByCacheKey: Record<string, TaskOption[]> = {};
  for (const [key, options] of taskEntries) {
    tasksByCacheKey[key] = options;
  }

  return { projectsByCustomerId, tasksByCacheKey };
}

export async function getHolidayDatesForWeek(
  calendarId: string | null,
  year: number,
  week: number
): Promise<string[]> {
  if (!calendarId) return [];
  const { start, end } = getISOWeekDateRange(year, week);
  const holidays = await getCalendarHolidays(calendarId);
  return holidays
    .filter((h) => h.holiday_date >= start && h.holiday_date <= end)
    .map((h) => h.holiday_date);
}

/** Inclusive YYYY-MM-DD range (calendar month or any span). */
export async function getHolidayDatesForRange(
  calendarId: string | null,
  start: string,
  end: string
): Promise<string[]> {
  if (!calendarId) return [];
  const holidays = await getCalendarHolidays(calendarId);
  return holidays
    .filter((h) => h.holiday_date >= start && h.holiday_date <= end)
    .map((h) => h.holiday_date);
}

async function getEffectiveRateSnapshot(
  projectId: string,
  customerId: string,
  roleId: string
): Promise<number | null> {
  const [projectRates, customerRates] = await Promise.all([
    getProjectRates(projectId),
    getCustomerRates(customerId),
  ]);
  const projectRate = projectRates.find((r) => r.role_id === roleId);
  if (projectRate != null) return Number(projectRate.rate_per_hour);
  const customerRate = customerRates.find((r) => r.role_id === roleId);
  if (customerRate != null) return Number(customerRate.rate_per_hour);
  return null;
}

type TimeReportRowDb = {
  id: string;
  entry_line_id: string;
  customer_id: string;
  project_id: string;
  role_id: string;
  jira_devops_key: string | null;
  description: string | null;
  entry_date: string;
  hours: string | number;
  internal_comment: string | null;
  rate_snapshot: string | number | null;
  display_order: string | number | null;
};

type TimeReportLineDb = {
  id: string;
  consultant_id: string;
  iso_year: number;
  iso_week: number;
  customer_id: string;
  project_id: string | null;
  role_id: string | null;
  jira_devops_key: string | null;
  description: string | null;
  display_order: string | number | null;
};

async function getAppUserIdForAudit(): Promise<string | null> {
  const u = await getCurrentAppUser();
  if (!u?.email) return null;
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id FROM app_users WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
    [u.email]
  );
  return rows[0]?.id ?? null;
}

function snapshotRowDb(r: TimeReportRowDb): Record<string, unknown> {
  return {
    id: r.id,
    entry_line_id: r.entry_line_id,
    customer_id: r.customer_id,
    project_id: r.project_id,
    role_id: r.role_id,
    jira_devops_key: r.jira_devops_key,
    description: r.description,
    entry_date: r.entry_date,
    hours: Number(r.hours ?? 0),
    internal_comment: r.internal_comment,
    rate_snapshot: r.rate_snapshot != null ? Number(r.rate_snapshot) : null,
    display_order: Number(r.display_order ?? 0),
  };
}

type DesiredCell = {
  entry_line_id: string;
  consultant_id: string;
  customer_id: string;
  project_id: string;
  role_id: string;
  jira_devops_key: string | null;
  description: string | null;
  entry_date: string;
  hours: number;
  internal_comment: string | null;
  rate_snapshot: number | null;
  display_order: number;
};

function desiredCellSnapshot(d: DesiredCell, dbId?: string): Record<string, unknown> {
  return {
    id: dbId,
    entry_line_id: d.entry_line_id,
    customer_id: d.customer_id,
    project_id: d.project_id,
    role_id: d.role_id,
    jira_devops_key: d.jira_devops_key,
    description: d.description,
    entry_date: d.entry_date,
    hours: d.hours,
    internal_comment: d.internal_comment,
    rate_snapshot: d.rate_snapshot,
    display_order: d.display_order,
  };
}

function cellDiffers(db: TimeReportRowDb, d: DesiredCell): boolean {
  return (
    db.customer_id !== d.customer_id ||
    db.project_id !== d.project_id ||
    db.role_id !== d.role_id ||
    (db.jira_devops_key ?? "") !== (d.jira_devops_key ?? "") ||
    (db.description ?? "") !== (d.description ?? "") ||
    Number(db.hours ?? 0) !== d.hours ||
    (db.internal_comment ?? "") !== (d.internal_comment ?? "") ||
    Number(db.rate_snapshot ?? 0) !== Number(d.rate_snapshot ?? 0) ||
    Number(db.display_order ?? 0) !== d.display_order
  );
}

async function writeEntryHistory(
  client: PoolClient,
  args: {
    timeReportEntryId: string | null;
    entryLineId: string;
    consultantId: string;
    operation: "insert" | "update" | "delete";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    sourceRevision: number;
    changedByAppUserId: string | null;
  }
) {
  await client.query(
    `INSERT INTO time_report_entries_history (
       time_report_entry_id, entry_line_id, consultant_id, operation,
       before_json, after_json, changed_by_app_user_id, source_revision
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::bigint)`,
    [
      args.timeReportEntryId,
      args.entryLineId,
      args.consultantId,
      args.operation,
      args.before ? JSON.stringify(args.before) : null,
      args.after ? JSON.stringify(args.after) : null,
      args.changedByAppUserId,
      args.sourceRevision,
    ]
  );
}

export async function getTimeReportEntries(
  consultantId: string,
  year: number,
  week: number,
  /** Month calendar scope for aggregated month UI only — hides lines from neighbouring months that share this ISO week. */
  calendarMonthForLineFilter?: { year: number; month: number } | null
): Promise<TimeReportWeekData> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) {
    return { groups: [], revision: 0 };
  }

  const weekDates = getISOWeekDateStrings(year, week);
  const filterActive = Boolean(calendarMonthForLineFilter);
  const bounds =
    calendarMonthForLineFilter != null
      ? calendarMonthDateBounds(calendarMonthForLineFilter.year, calendarMonthForLineFilter.month)
      : { start: "1970-01-01", end: "1970-01-01" };

  const [{ rows: revRows }, { rows: lineRows }, { rows: entryRows }] = await Promise.all([
    cloudSqlPool.query<{ revision: string | null }>(
      `SELECT revision::text FROM time_report_week_revisions
       WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3`,
      [consultantId, year, week]
    ),
    cloudSqlPool.query<TimeReportLineDb>(
      `SELECT id, consultant_id, iso_year, iso_week, customer_id, project_id, role_id,
              jira_devops_key, description, display_order
       FROM time_report_entry_lines l
       WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3
         AND (
           NOT $4::boolean
           OR EXISTS (
             SELECT 1 FROM time_report_entries e
             WHERE e.consultant_id = l.consultant_id
               AND e.entry_line_id = l.id
               AND e.entry_date >= $5::date
               AND e.entry_date <= $6::date
           )
           OR (
             NOT EXISTS (
               SELECT 1 FROM time_report_entries e
               WHERE e.consultant_id = l.consultant_id AND e.entry_line_id = l.id
             )
             AND l.created_at::date >= $5::date
             AND l.created_at::date <= $6::date
           )
         )
       ORDER BY display_order ASC NULLS LAST, id ASC`,
      [consultantId, year, week, filterActive, bounds.start, bounds.end]
    ),
    cloudSqlPool.query<TimeReportRowDb>(
      `SELECT id, entry_line_id, customer_id, project_id, role_id, jira_devops_key, description,
              entry_date::text AS entry_date, hours, internal_comment, rate_snapshot, display_order
       FROM time_report_entries
       WHERE consultant_id = $1 AND entry_date = ANY($2::date[])
       ORDER BY display_order ASC NULLS LAST, entry_date ASC`,
      [consultantId, weekDates]
    ),
  ]);

  const revision = Number(revRows[0]?.revision ?? 0);

  let filteredLines = lineRows;
  let filteredRows = entryRows;
  const appUser = await getCurrentAppUser();
  if (isSubcontractorRole(appUser?.role)) {
    const internalCustomerId = await getInternalCustomerId();
    if (internalCustomerId) {
      filteredLines = filteredLines.filter((r) => r.customer_id !== internalCustomerId);
      filteredRows = filteredRows.filter((r) => r.customer_id !== internalCustomerId);
    }
  }

  const byLineId = new Map<string, TimeReportRowDb[]>();
  for (const r of filteredRows) {
    if (!byLineId.has(r.entry_line_id)) byLineId.set(r.entry_line_id, []);
    byLineId.get(r.entry_line_id)!.push(r);
  }

  const byCustomer = new Map<string, TimeReportEntry[]>();
  for (const line of filteredLines) {
    if (!byCustomer.has(line.customer_id)) {
      byCustomer.set(line.customer_id, []);
    }
    const dayRows = byLineId.get(line.id) ?? [];
    const hours: number[] = [0, 0, 0, 0, 0, 0, 0];
    const comments: Record<number, string> = {};
    for (const row of dayRows) {
      const dayIndex = weekDates.indexOf(row.entry_date);
      if (dayIndex >= 0) {
        hours[dayIndex] = Number(row.hours ?? 0);
        if (row.internal_comment) comments[dayIndex] = row.internal_comment;
      }
    }
    byCustomer.get(line.customer_id)!.push({
      id: line.id,
      displayOrder: Number(line.display_order ?? 0),
      projectId: line.project_id ?? "",
      roleId: line.role_id ?? "",
      jiraDevOpsValue: line.jira_devops_key ?? "",
      task: line.description ?? "",
      hours,
      comments,
    });
  }

  const customerIds = [...byCustomer.keys()];
  if (customerIds.length > 0) {
    const { rows: nameRows } = await cloudSqlPool.query<{ id: string; name: string }>(
      `SELECT id::text AS id, name FROM customers WHERE id = ANY($1::uuid[])`,
      [customerIds]
    );
    const nameById = new Map(nameRows.map((r) => [r.id, r.name]));
    customerIds.sort((a, b) => {
      const cmp = (nameById.get(a) ?? "").localeCompare(nameById.get(b) ?? "", "sv", {
        sensitivity: "base",
      });
      if (cmp !== 0) return cmp;
      return a.localeCompare(b);
    });
  }

  const groups = customerIds.map((customerId) => ({
    customerId,
    entries: byCustomer.get(customerId)!,
  }));
  return { groups, revision };
}

export async function getTimeReportMonthTotalHours(
  consultantId: string,
  year: number,
  month: number
): Promise<number> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) return 0;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(year, month, 0);
  const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(
    monthEnd.getDate()
  ).padStart(2, "0")}`;

  const appUser = await getCurrentAppUser();
  const internalCustomerId =
    isSubcontractorRole(appUser?.role) ? await getInternalCustomerId() : null;

  const { rows } = await cloudSqlPool.query<{ total_hours: string | number | null }>(
    internalCustomerId
      ? `SELECT COALESCE(SUM(hours), 0) AS total_hours
         FROM time_report_entries
         WHERE consultant_id = $1
           AND entry_date >= $2::date
           AND entry_date <= $3::date
           AND customer_id <> $4::uuid`
      : `SELECT COALESCE(SUM(hours), 0) AS total_hours
         FROM time_report_entries
         WHERE consultant_id = $1
           AND entry_date >= $2::date
           AND entry_date <= $3::date`,
    internalCustomerId
      ? [consultantId, monthStart, monthEndStr, internalCustomerId]
      : [consultantId, monthStart, monthEndStr]
  );

  return Number(rows[0]?.total_hours ?? 0);
}

export async function saveTimeReportEntries(
  consultantId: string,
  year: number,
  week: number,
  customerGroups: TimeReportCustomerGroup[],
  expectedRevision: number,
  calendarMonthScope?: SaveTimeReportCalendarMonthScope | null,
  deletedLineIds?: string[]
): Promise<SaveTimeReportEntriesResult> {
  const ctx = await getTimeReportAccessContext();
  const consultant = ctx.consultant;
  if (!consultant || consultant.id !== consultantId) {
    return { success: false, error: "Unauthorized" };
  }

  const isSubcontractor = isSubcontractorRole(ctx.appUser?.role);
  const weekDates = getISOWeekDateStrings(year, week);
  const scopeBounds = calendarMonthScope
    ? calendarMonthDateBounds(calendarMonthScope.year, calendarMonthScope.month)
    : null;

  const desired: DesiredCell[] = [];
  const desiredLines: Array<{
    id: string;
    consultant_id: string;
    iso_year: number;
    iso_week: number;
    customer_id: string;
    project_id: string | null;
    role_id: string | null;
    jira_devops_key: string | null;
    description: string | null;
    display_order: number;
  }> = [];
  const explicitDeletedLineIds = new Set(
    (deletedLineIds ?? []).map((v) => v.trim()).filter((v) => v !== "")
  );

  const projectIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const group of customerGroups) {
    if (!ctx.allowedCustomerIds.has(group.customerId)) {
      return { success: false, error: "Unauthorized customer." };
    }
    customerIds.add(group.customerId);
    for (const entry of group.entries) {
      if (isSubcontractor && entry.projectId && !ctx.bookedProjectIds.has(entry.projectId)) {
        return { success: false, error: "Unauthorized project for subcontractor." };
      }
      if (entry.projectId) projectIds.add(entry.projectId);
    }
  }
  const [allProjectRates, allCustomerRates] = await Promise.all([
    Promise.all(Array.from(projectIds).map(async (id) => [id, await getProjectRates(id)] as const)),
    Promise.all(Array.from(customerIds).map(async (id) => [id, await getCustomerRates(id)] as const)),
  ]);

  const projectRoleRateMap = new Map<string, Map<string, number>>();
  for (const [projectId, rates] of allProjectRates) {
    const roleMap = new Map<string, number>();
    for (const r of rates) roleMap.set(r.role_id, Number(r.rate_per_hour));
    projectRoleRateMap.set(projectId, roleMap);
  }

  const customerRoleRateMap = new Map<string, Map<string, number>>();
  for (const [customerId, rates] of allCustomerRates) {
    const roleMap = new Map<string, number>();
    for (const r of rates) roleMap.set(r.role_id, Number(r.rate_per_hour));
    customerRoleRateMap.set(customerId, roleMap);
  }

  const resolveRateSnapshot = (
    projectId: string,
    customerId: string,
    roleId: string
  ): number | null => {
    const fromProject = projectRoleRateMap.get(projectId)?.get(roleId);
    if (fromProject != null) return fromProject;
    const fromCustomer = customerRoleRateMap.get(customerId)?.get(roleId);
    if (fromCustomer != null) return fromCustomer;
    return null;
  };

  for (let cgIndex = 0; cgIndex < customerGroups.length; cgIndex++) {
    const group = customerGroups[cgIndex];
    for (let eIndex = 0; eIndex < group.entries.length; eIndex++) {
      const entry = group.entries[eIndex]!;
      const hasContent =
        (entry.hours?.some((h) => (h ?? 0) > 0) ?? false) ||
        Object.values(entry.comments ?? {}).some((c) => (c ?? "").trim() !== "");
      if (hasContent && (!entry.projectId || !entry.roleId)) {
        return {
          success: false,
          error: "Project and Role are required for all rows with hours or comments.",
        };
      }
      const displayOrder = cgIndex * 1000 + eIndex;
      const entryLineId = (entry.id && entry.id.trim() !== "" ? entry.id : randomUUID()) as string;
      desiredLines.push({
        id: entryLineId,
        consultant_id: consultantId,
        iso_year: year,
        iso_week: week,
        customer_id: group.customerId,
        project_id: entry.projectId || null,
        role_id: entry.roleId || null,
        jira_devops_key: entry.jiraDevOpsValue || null,
        description: (entry.task ?? "").trim() || null,
        display_order: displayOrder,
      });

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const entryDate = weekDates[dayIndex]!;
        if (
          scopeBounds &&
          !dateStrInInclusiveBounds(entryDate, scopeBounds.start, scopeBounds.end)
        ) {
          continue;
        }
        const hours = entry.hours[dayIndex] ?? 0;
        const comment = entry.comments[dayIndex]?.trim() ?? "";
        if (hours > 0 && entry.projectId && entry.roleId) {
          const rateSnapshot = resolveRateSnapshot(entry.projectId, group.customerId, entry.roleId);
          desired.push({
            entry_line_id: entryLineId,
            consultant_id: consultantId,
            customer_id: group.customerId,
            project_id: entry.projectId,
            role_id: entry.roleId,
            jira_devops_key: entry.jiraDevOpsValue || null,
            description: (entry.task ?? "").trim() || null,
            entry_date: entryDate,
            hours,
            internal_comment: comment || null,
            rate_snapshot: rateSnapshot,
            display_order: displayOrder,
          });
        }
      }
    }
  }

  // Never let one request contain conflicting definitions for the same line id.
  // This otherwise causes non-deterministic "last write wins" behavior.
  const lineShapeById = new Map<string, string>();
  for (const line of desiredLines) {
    if (explicitDeletedLineIds.has(line.id)) continue;
    const shape = [
      line.customer_id,
      line.project_id ?? "",
      line.role_id ?? "",
      line.jira_devops_key ?? "",
      line.description ?? "",
      String(line.display_order),
    ].join("|");
    const prev = lineShapeById.get(line.id);
    if (prev && prev !== shape) {
      return { success: false, error: "Ambiguous line identity in save payload." };
    }
    lineShapeById.set(line.id, shape);
  }

  const appUserId = await getAppUserIdForAudit();
  const client = await cloudSqlPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO time_report_week_revisions (consultant_id, iso_year, iso_week, revision)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (consultant_id, iso_year, iso_week) DO NOTHING`,
      [consultantId, year, week]
    );

    const { rows: revLock } = await client.query<{ revision: string }>(
      `SELECT revision::text FROM time_report_week_revisions
       WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3
       FOR UPDATE`,
      [consultantId, year, week]
    );
    const currentRev = Number(revLock[0]?.revision ?? 0);
    if (currentRev !== expectedRevision) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Tidrapporten har uppdaterats någon annanstans. Ladda om innan du sparar igen.",
        code: "revision_conflict",
        currentRevision: currentRev,
      };
    }

    const newRevision = currentRev + 1;

    const { rows: existingLines } = await client.query<TimeReportLineDb>(
      `SELECT id, consultant_id, iso_year, iso_week, customer_id, project_id, role_id,
              jira_devops_key, description, display_order
       FROM time_report_entry_lines
       WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3
       FOR UPDATE`,
      [consultantId, year, week]
    );

    const existingLineById = new Map<string, TimeReportLineDb>();
    for (const l of existingLines) existingLineById.set(l.id, l);
    const desiredLineById = new Map<string, (typeof desiredLines)[number]>();
    for (const l of desiredLines) {
      if (explicitDeletedLineIds.has(l.id)) continue;
      desiredLineById.set(l.id, l);
    }

    for (const lineId of explicitDeletedLineIds) {
      if (!existingLineById.has(lineId)) continue;
      // Delete only within the visible scope:
      // - week view: only this ISO week's cells + header
      // - month view: only this calendar month's cells in this ISO week,
      //   then drop header only when no week cells remain.
      if (scopeBounds) {
        await client.query(
          `DELETE FROM time_report_entries
           WHERE consultant_id = $1
             AND entry_line_id = $2
             AND entry_date = ANY($3::date[])
             AND entry_date >= $4::date
             AND entry_date <= $5::date`,
          [consultantId, lineId, weekDates, scopeBounds.start, scopeBounds.end]
        );
        const { rows: rem } = await client.query<{ c: string }>(
          `SELECT COUNT(*)::text AS c
           FROM time_report_entries
           WHERE consultant_id = $1
             AND entry_line_id = $2
             AND entry_date = ANY($3::date[])`,
          [consultantId, lineId, weekDates]
        );
        const remainingInWeek = Number(rem[0]?.c ?? 0);
        if (remainingInWeek === 0) {
          await client.query(
            `DELETE FROM time_report_entry_lines
             WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3 AND id = $4`,
            [consultantId, year, week, lineId]
          );
        }
      } else {
        await client.query(
          `DELETE FROM time_report_entries
           WHERE consultant_id = $1
             AND entry_line_id = $2
             AND entry_date = ANY($3::date[])`,
          [consultantId, lineId, weekDates]
        );
        await client.query(
          `DELETE FROM time_report_entry_lines
           WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3 AND id = $4`,
          [consultantId, year, week, lineId]
        );
      }
    }

    for (const [lineId, de] of desiredLineById) {
      const ex = existingLineById.get(lineId);
      if (!ex) {
        const monthAnchorDate =
          calendarMonthScope != null
            ? `${calendarMonthScope.year}-${String(calendarMonthScope.month).padStart(2, "0")}-01`
            : null;
        await client.query(
          `INSERT INTO time_report_entry_lines (
             id, consultant_id, iso_year, iso_week, customer_id, project_id, role_id,
             jira_devops_key, description, display_order, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, COALESCE($11::date, now()), COALESCE($11::date, now()))`,
          [
            de.id,
            de.consultant_id,
            de.iso_year,
            de.iso_week,
            de.customer_id,
            de.project_id,
            de.role_id,
            de.jira_devops_key,
            de.description,
            de.display_order,
            monthAnchorDate,
          ]
        );
      } else {
        await client.query(
          `UPDATE time_report_entry_lines SET
             customer_id = $3,
             project_id = $4,
             role_id = $5,
             jira_devops_key = $6,
             description = $7,
             display_order = $8
           WHERE consultant_id = $1 AND iso_year = $9 AND iso_week = $10 AND id = $2`,
          [
            consultantId,
            lineId,
            de.customer_id,
            de.project_id,
            de.role_id,
            de.jira_devops_key,
            de.description,
            de.display_order,
            year,
            week,
          ]
        );
      }
    }

    const lineIds = Array.from(desiredLineById.keys());
    const { rows: existingRows } = await client.query<TimeReportRowDb>(
      `SELECT id, entry_line_id, customer_id, project_id, role_id, jira_devops_key, description,
              entry_date::text AS entry_date, hours, internal_comment, rate_snapshot, display_order
       FROM time_report_entries
       WHERE consultant_id = $1
         AND entry_line_id = ANY($2::uuid[])
         AND entry_date = ANY($3::date[])
       FOR UPDATE`,
      [consultantId, lineIds.length > 0 ? lineIds : [randomUUID()], weekDates]
    );

    const existingByKey = new Map<string, TimeReportRowDb>();
    for (const r of existingRows) {
      existingByKey.set(`${r.entry_line_id}|${r.entry_date}`, r);
    }

    const desiredByKey = new Map<string, DesiredCell>();
    for (const d of desired) {
      if (explicitDeletedLineIds.has(d.entry_line_id)) continue;
      desiredByKey.set(`${d.entry_line_id}|${d.entry_date}`, d);
    }

    for (const [key, ex] of existingByKey) {
      if (!desiredByKey.has(key)) {
        if (
          scopeBounds &&
          !dateStrInInclusiveBounds(ex.entry_date, scopeBounds.start, scopeBounds.end)
        ) {
          continue;
        }
        await writeEntryHistory(client, {
          timeReportEntryId: ex.id,
          entryLineId: ex.entry_line_id,
          consultantId,
          operation: "delete",
          before: snapshotRowDb(ex),
          after: null,
          sourceRevision: newRevision,
          changedByAppUserId: appUserId,
        });
        await client.query(`DELETE FROM time_report_entries WHERE id = $1`, [ex.id]);
      }
    }

    for (const [key, de] of desiredByKey) {
      const ex = existingByKey.get(key);
      if (!ex) {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO time_report_entries (
             consultant_id, customer_id, project_id, role_id, jira_devops_key,
             description, entry_date, hours, pm_edited_hours, internal_comment, rate_snapshot, display_order,
             entry_line_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$8,$9,$10,$11,$12)
           RETURNING id`,
          [
            de.consultant_id,
            de.customer_id,
            de.project_id,
            de.role_id,
            de.jira_devops_key,
            de.description,
            de.entry_date,
            de.hours,
            de.internal_comment,
            de.rate_snapshot,
            de.display_order,
            de.entry_line_id,
          ]
        );
        const newId = ins.rows[0]?.id;
        await writeEntryHistory(client, {
          timeReportEntryId: newId ?? null,
          entryLineId: de.entry_line_id,
          consultantId,
          operation: "insert",
          before: null,
          after: desiredCellSnapshot(de, newId),
          sourceRevision: newRevision,
          changedByAppUserId: appUserId,
        });
      } else if (cellDiffers(ex, de)) {
        await client.query(
          `UPDATE time_report_entries SET
             customer_id = $2,
             project_id = $3,
             role_id = $4,
             jira_devops_key = $5,
             description = $6,
             hours = $7,
             pm_edited_hours = $7,
             internal_comment = $8,
             rate_snapshot = $9,
             display_order = $10,
             entry_line_id = $11
           WHERE id = $1`,
          [
            ex.id,
            de.customer_id,
            de.project_id,
            de.role_id,
            de.jira_devops_key,
            de.description,
            de.hours,
            de.internal_comment,
            de.rate_snapshot,
            de.display_order,
            de.entry_line_id,
          ]
        );
        await writeEntryHistory(client, {
          timeReportEntryId: ex.id,
          entryLineId: de.entry_line_id,
          consultantId,
          operation: "update",
          before: snapshotRowDb(ex),
          after: desiredCellSnapshot(de, ex.id),
          sourceRevision: newRevision,
          changedByAppUserId: appUserId,
        });
      }
    }

    await client.query(
      `UPDATE time_report_week_revisions
       SET revision = $1::bigint,
           updated_at = now(),
           updated_by_app_user_id = $2
       WHERE consultant_id = $3 AND iso_year = $4 AND iso_week = $5`,
      [newRevision, appUserId, consultantId, year, week]
    );

    await client.query("COMMIT");
    return { success: true, revision: newRevision };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and return the original failure.
    }
    return { success: false, error: e instanceof Error ? e.message : "Save failed" };
  } finally {
    client.release();
  }
}

export async function copyEntryToWeek(
  consultantId: string,
  targetYear: number,
  targetWeek: number,
  customerId: string,
  entry: TimeReportEntryCopyPayload,
  expectedRevision: number
): Promise<CopyEntryToWeekResult> {
  const ctx = await getTimeReportAccessContext();
  const consultant = ctx.consultant;
  if (!consultant || consultant.id !== consultantId) {
    return { success: false, error: "Unauthorized" };
  }
  if (!ctx.allowedCustomerIds.has(customerId)) {
    return { success: false, error: "Unauthorized customer." };
  }
  if (
    isSubcontractorRole(ctx.appUser?.role) &&
    entry.projectId &&
    !ctx.bookedProjectIds.has(entry.projectId)
  ) {
    return { success: false, error: "Unauthorized project for subcontractor." };
  }
  const copyHours = entry.copyHours !== false;
  const hasProjectAndRole = Boolean(entry.projectId && entry.roleId);
  if (copyHours && !hasProjectAndRole) {
    return { success: false, error: "Project and Role are required." };
  }

  const weekDates = getISOWeekDateStrings(targetYear, targetWeek);
  const rateSnapshot =
    entry.projectId && entry.roleId
      ? await getEffectiveRateSnapshot(entry.projectId, customerId, entry.roleId)
      : null;

  const toInsert: DesiredCell[] = [];
  const entryLineId = entry.lineId?.trim() ? entry.lineId.trim() : randomUUID();
  const displayOrderPlaceholder = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const hours = copyHours ? (entry.hours[dayIndex] ?? 0) : 0;
    const comment = copyHours ? (entry.comments[dayIndex]?.trim() ?? "") : "";
    if (hours > 0 && entry.projectId && entry.roleId) {
      toInsert.push({
        entry_line_id: entryLineId,
        consultant_id: consultantId,
        customer_id: customerId,
        project_id: entry.projectId,
        role_id: entry.roleId,
        jira_devops_key: entry.jiraDevOpsValue || null,
        description: (entry.task ?? "").trim() || null,
        entry_date: weekDates[dayIndex]!,
        hours,
        internal_comment: comment || null,
        rate_snapshot: rateSnapshot,
        display_order: displayOrderPlaceholder,
      });
    }
  }

  if (copyHours && toInsert.length === 0) {
    return { success: false, error: "Entry has no hours or comments to copy." };
  }

  const appUserId = await getAppUserIdForAudit();
  const client = await cloudSqlPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: ordRows } = await client.query<{ display_order: string | number | null }>(
      `SELECT display_order
       FROM time_report_entry_lines
       WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3`,
      [consultantId, targetYear, targetWeek]
    );
    const maxOrder =
      ordRows.length && ordRows.every((r) => r.display_order != null)
        ? Math.max(...ordRows.map((r) => Number(r.display_order)))
        : 0;
    const displayOrder = maxOrder + 1000;
    for (const r of toInsert) {
      r.display_order = displayOrder;
    }

    await client.query(
      `INSERT INTO time_report_week_revisions (consultant_id, iso_year, iso_week, revision)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (consultant_id, iso_year, iso_week) DO NOTHING`,
      [consultantId, targetYear, targetWeek]
    );

    const { rows: revLock } = await client.query<{ revision: string }>(
      `SELECT revision::text FROM time_report_week_revisions
       WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3
       FOR UPDATE`,
      [consultantId, targetYear, targetWeek]
    );
    const currentRev = Number(revLock[0]?.revision ?? 0);
    if (currentRev !== expectedRevision) {
      await client.query("ROLLBACK");
      return {
        success: false,
        error: "Tidrapporten har uppdaterats någon annanstans. Ladda om innan du kopierar igen.",
        code: "revision_conflict",
        currentRevision: currentRev,
      };
    }

    const newRevision = currentRev + 1;
    const rowOnlyLineCreatedAt = !copyHours ? (entry.rowOnlyAnchorDate ?? null) : null;

    await client.query(
      `INSERT INTO time_report_entry_lines (
         id, consultant_id, iso_year, iso_week, customer_id, project_id, role_id,
         jira_devops_key, description, display_order, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, COALESCE($11::date, now()), COALESCE($11::date, now()))`,
      [
        entryLineId,
        consultantId,
        targetYear,
        targetWeek,
        customerId,
        entry.projectId || null,
        entry.roleId || null,
        entry.jiraDevOpsValue || null,
        (entry.task ?? "").trim() || null,
        displayOrder,
        rowOnlyLineCreatedAt,
      ]
    );

    for (const de of toInsert) {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO time_report_entries (
           consultant_id, customer_id, project_id, role_id, jira_devops_key,
           description, entry_date, hours, pm_edited_hours, internal_comment, rate_snapshot, display_order,
           entry_line_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          de.consultant_id,
          de.customer_id,
          de.project_id,
          de.role_id,
          de.jira_devops_key,
          de.description,
          de.entry_date,
          de.hours,
          de.internal_comment,
          de.rate_snapshot,
          de.display_order,
          de.entry_line_id,
        ]
      );
      const newId = ins.rows[0]?.id;
      await writeEntryHistory(client, {
        timeReportEntryId: newId ?? null,
        entryLineId: de.entry_line_id,
        consultantId,
        operation: "insert",
        before: null,
        after: desiredCellSnapshot(de, newId),
        sourceRevision: newRevision,
        changedByAppUserId: appUserId,
      });
    }

    await client.query(
      `UPDATE time_report_week_revisions
       SET revision = $1::bigint,
           updated_at = now(),
           updated_by_app_user_id = $2
       WHERE consultant_id = $3 AND iso_year = $4 AND iso_week = $5`,
      [newRevision, appUserId, consultantId, targetYear, targetWeek]
    );

    await client.query("COMMIT");
    return { success: true, revision: newRevision };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and return the original failure.
    }
    return { success: false, error: e instanceof Error ? e.message : "Insert failed" };
  } finally {
    client.release();
  }
}

/** Lightweight revision check for visibility refresh (same semantics as load). */
export async function getTimeReportWeekRevision(
  consultantId: string,
  year: number,
  week: number
): Promise<number | null> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) return null;
  const { rows } = await cloudSqlPool.query<{ revision: string | null }>(
    `SELECT revision::text FROM time_report_week_revisions
     WHERE consultant_id = $1 AND iso_year = $2 AND iso_week = $3`,
    [consultantId, year, week]
  );
  return Number(rows[0]?.revision ?? 0);
}

/** Batch revision lookup for month view (`${year}-W${week}` keys, missing weeks → 0). */
export async function getTimeReportWeekRevisions(
  consultantId: string,
  weeks: { year: number; week: number }[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const w of weeks) {
    out[`${w.year}-W${w.week}`] = 0;
  }

  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId || weeks.length === 0) {
    return out;
  }

  const years = weeks.map((w) => w.year);
  const wks = weeks.map((w) => w.week);
  const { rows } = await cloudSqlPool.query<{
    iso_year: number;
    iso_week: number;
    revision: string;
  }>(
    `SELECT iso_year, iso_week, revision::text
     FROM time_report_week_revisions
     WHERE consultant_id = $1
       AND (iso_year, iso_week) IN (SELECT * FROM unnest($2::int[], $3::int[]) AS t(y, wk))`,
    [consultantId, years, wks]
  );
  for (const r of rows) {
    out[`${r.iso_year}-W${r.iso_week}`] = Number(r.revision);
  }
  return out;
}
