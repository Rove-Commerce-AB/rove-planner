import "server-only";

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
import { getInternalRoveCustomerId } from "@/lib/customers";
import type {
  JiraDevOpsOption,
  ProjectOption,
  TaskOption,
  TimeReportCustomerGroup,
  TimeReportEntry,
  TimeReportEntryCopyPayload,
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
    const roveId = await getInternalRoveCustomerId();
    if (roveId) allowedCustomerIds.delete(roveId);
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

type TimeReportRow = {
  id: string;
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

export async function getTimeReportEntries(
  consultantId: string,
  year: number,
  week: number
): Promise<TimeReportCustomerGroup[]> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) return [];

  const weekDates = getISOWeekDateStrings(year, week);

  let { rows } = await cloudSqlPool.query<TimeReportRow>(
    `SELECT id, customer_id, project_id, role_id, jira_devops_key, description,
            entry_date::text AS entry_date, hours, internal_comment, rate_snapshot, display_order
     FROM time_report_entries
     WHERE consultant_id = $1 AND entry_date = ANY($2::date[])
     ORDER BY display_order ASC NULLS LAST, entry_date ASC`,
    [consultantId, weekDates]
  );

  const appUser = await getCurrentAppUser();
  if (isSubcontractorRole(appUser?.role)) {
    const roveId = await getInternalRoveCustomerId();
    if (roveId) rows = rows.filter((r) => r.customer_id !== roveId);
  }

  if (!rows.length) return [];

  const groupKey = (r: TimeReportRow) =>
    `${r.customer_id}|${r.project_id}|${r.role_id}|${r.jira_devops_key ?? ""}|${Number(r.display_order ?? 0)}`;
  const byGroup = new Map<string, TimeReportRow[]>();
  for (const r of rows) {
    const key = groupKey(r);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(r);
  }

  const byCustomer = new Map<string, { key: string; dayRows: TimeReportRow[] }[]>();
  for (const [, dayRows] of byGroup) {
    const first = dayRows[0];
    const customerId = first.customer_id;
    if (!byCustomer.has(customerId)) byCustomer.set(customerId, []);
    byCustomer.get(customerId)!.push({ key: groupKey(first), dayRows });
  }

  const result: TimeReportCustomerGroup[] = [];
  for (const [customerId, groups] of byCustomer) {
    groups.sort((a, b) => {
      const orderA = Number(a.dayRows[0]?.display_order ?? 0);
      const orderB = Number(b.dayRows[0]?.display_order ?? 0);
      return orderA - orderB;
    });
    const entries: TimeReportEntry[] = groups.map(({ dayRows }) => {
      const hours: number[] = [0, 0, 0, 0, 0, 0, 0];
      const comments: Record<number, string> = {};
      for (const row of dayRows) {
        const dayIndex = weekDates.indexOf(row.entry_date);
        if (dayIndex >= 0) {
          hours[dayIndex] = Number(row.hours ?? 0);
          if (row.internal_comment) comments[dayIndex] = row.internal_comment;
        }
      }
      const first = dayRows[0];
      return {
        id: first.id,
        projectId: first.project_id,
        roleId: first.role_id,
        jiraDevOpsValue: first.jira_devops_key ?? "",
        task: first.description ?? "",
        hours,
        comments,
      };
    });
    result.push({ customerId, entries });
  }

  const customerOrder = [...new Set(rows.map((r) => r.customer_id))];
  result.sort(
    (a, b) => customerOrder.indexOf(a.customerId) - customerOrder.indexOf(b.customerId)
  );

  return result;
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
  const roveId =
    isSubcontractorRole(appUser?.role) ? await getInternalRoveCustomerId() : null;

  const { rows } = await cloudSqlPool.query<{ total_hours: string | number | null }>(
    roveId
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
    roveId
      ? [consultantId, monthStart, monthEndStr, roveId]
      : [consultantId, monthStart, monthEndStr]
  );

  return Number(rows[0]?.total_hours ?? 0);
}

export async function saveTimeReportEntries(
  consultantId: string,
  year: number,
  week: number,
  customerGroups: TimeReportCustomerGroup[]
): Promise<{ error?: string }> {
  const ctx = await getTimeReportAccessContext();
  const consultant = ctx.consultant;
  if (!consultant || consultant.id !== consultantId) {
    return { error: "Unauthorized" };
  }

  const isSubcontractor = isSubcontractorRole(ctx.appUser?.role);
  const weekDates = getISOWeekDateStrings(year, week);

  const rows: {
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
  }[] = [];

  const projectIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const group of customerGroups) {
    if (!ctx.allowedCustomerIds.has(group.customerId)) {
      return { error: "Unauthorized customer." };
    }
    customerIds.add(group.customerId);
    for (const entry of group.entries) {
      if (isSubcontractor && entry.projectId && !ctx.bookedProjectIds.has(entry.projectId)) {
        return { error: "Unauthorized project for subcontractor." };
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
      const entry = group.entries[eIndex];
      const hasContent =
        (entry.hours?.some((h) => (h ?? 0) > 0) ?? false) ||
        Object.values(entry.comments ?? {}).some((c) => (c ?? "").trim() !== "");
      if (hasContent && (!entry.projectId || !entry.roleId)) {
        return { error: "Project and Role are required for all rows with hours or comments." };
      }
      if (!entry.projectId || !entry.roleId) continue;
      const displayOrder = cgIndex * 1000 + eIndex;
      const rateSnapshot = resolveRateSnapshot(entry.projectId, group.customerId, entry.roleId);

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const hours = entry.hours[dayIndex] ?? 0;
        const comment = entry.comments[dayIndex]?.trim() ?? "";
        if (hours > 0 || comment !== "") {
          rows.push({
            consultant_id: consultantId,
            customer_id: group.customerId,
            project_id: entry.projectId,
            role_id: entry.roleId,
            jira_devops_key: entry.jiraDevOpsValue || null,
            description: (entry.task ?? "").trim() || null,
            entry_date: weekDates[dayIndex],
            hours,
            internal_comment: comment || null,
            rate_snapshot: rateSnapshot,
            display_order: displayOrder,
          });
        }
      }
    }
  }

  const client = await cloudSqlPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM time_report_entries WHERE consultant_id = $1 AND entry_date = ANY($2::date[])`,
      [consultantId, weekDates]
    );
    for (const row of rows) {
      await client.query(
        `INSERT INTO time_report_entries (
           consultant_id, customer_id, project_id, role_id, jira_devops_key,
           description, entry_date, hours, pm_edited_hours, internal_comment, rate_snapshot, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$8,$9,$10,$11)`,
        [
          row.consultant_id,
          row.customer_id,
          row.project_id,
          row.role_id,
          row.jira_devops_key,
          row.description,
          row.entry_date,
          row.hours,
          row.internal_comment,
          row.rate_snapshot,
          row.display_order,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors and return the original failure.
    }
    return { error: e instanceof Error ? e.message : "Save failed" };
  } finally {
    client.release();
  }

  return {};
}

export async function copyEntryToWeek(
  consultantId: string,
  targetYear: number,
  targetWeek: number,
  customerId: string,
  entry: TimeReportEntryCopyPayload
): Promise<{ error?: string }> {
  const ctx = await getTimeReportAccessContext();
  const consultant = ctx.consultant;
  if (!consultant || consultant.id !== consultantId) {
    return { error: "Unauthorized" };
  }
  if (!ctx.allowedCustomerIds.has(customerId)) {
    return { error: "Unauthorized customer." };
  }
  if (isSubcontractorRole(ctx.appUser?.role) && !ctx.bookedProjectIds.has(entry.projectId)) {
    return { error: "Unauthorized project for subcontractor." };
  }
  if (!entry.projectId || !entry.roleId) {
    return { error: "Project and Role are required." };
  }

  const weekDates = getISOWeekDateStrings(targetYear, targetWeek);

  const { rows: existing } = await cloudSqlPool.query<{ display_order: number | null }>(
    `SELECT display_order FROM time_report_entries
     WHERE consultant_id = $1 AND entry_date = ANY($2::date[])`,
    [consultantId, weekDates]
  );

  const maxOrder =
    existing.length && existing.every((r) => r.display_order != null)
      ? Math.max(...existing.map((r) => Number(r.display_order)))
      : 0;
  const displayOrder = maxOrder + 1000;

  const rateSnapshot = await getEffectiveRateSnapshot(
    entry.projectId,
    customerId,
    entry.roleId
  );

  const copyHours = entry.copyHours !== false;

  const rows: {
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
  }[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const hours = copyHours ? (entry.hours[dayIndex] ?? 0) : 0;
    const comment = copyHours ? (entry.comments[dayIndex]?.trim() ?? "") : "";
    if (copyHours) {
      if (hours > 0 || comment !== "") {
        rows.push({
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
          display_order: displayOrder,
        });
      }
    } else {
      rows.push({
        consultant_id: consultantId,
        customer_id: customerId,
        project_id: entry.projectId,
        role_id: entry.roleId,
        jira_devops_key: entry.jiraDevOpsValue || null,
        description: (entry.task ?? "").trim() || null,
        entry_date: weekDates[dayIndex]!,
        hours: 0,
        internal_comment: null,
        rate_snapshot: rateSnapshot,
        display_order: displayOrder,
      });
    }
  }

  if (rows.length === 0) {
    return { error: "Entry has no hours or comments to copy." };
  }

  for (const row of rows) {
    try {
      await cloudSqlPool.query(
        `INSERT INTO time_report_entries (
           consultant_id, customer_id, project_id, role_id, jira_devops_key,
           description, entry_date, hours, pm_edited_hours, internal_comment, rate_snapshot, display_order
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$8,$9,$10,$11)`,
        [
          row.consultant_id,
          row.customer_id,
          row.project_id,
          row.role_id,
          row.jira_devops_key,
          row.description,
          row.entry_date,
          row.hours,
          row.internal_comment,
          row.rate_snapshot,
          row.display_order,
        ]
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Insert failed" };
    }
  }
  return {};
}
