import "server-only";

import { getProjectsByCustomerIds } from "@/lib/projects";
import {
  getJiraIssuesByProjectKey,
  getDevOpsWorkItemsByProject,
} from "@/lib/timeReportIntegrations";
import { createClient } from "@/lib/supabase/server";
import { getCustomerRates } from "@/lib/customerRates";
import { getProjectRates, getRolesWithRateForAllocation } from "@/lib/projectRates";
import { getCalendarHolidays } from "@/lib/calendarHolidays";
import { getISOWeekDateRange, getISOWeekDateStrings } from "@/lib/dateUtils";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import type {
  JiraDevOpsOption,
  ProjectOption,
  TaskOption,
  TimeReportCustomerGroup,
  TimeReportEntry,
  TimeReportEntryCopyPayload,
} from "@/types";

export async function getActiveProjectsForCustomer(
  customerId: string
): Promise<ProjectOption[]> {
  if (!customerId) return [];
  const projects = await getProjectsByCustomerIds([customerId]);
  const active = projects.filter((p) => p.is_active);
  return active.map((p) => ({ value: p.id, label: p.name }));
}

export async function getJiraDevOpsOptionsForProject(
  projectId: string
): Promise<JiraDevOpsOption[]> {
  if (!projectId) return [];
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("jira_project_key, devops_project")
    .eq("id", projectId)
    .single();
  if (error || !project) return [];

  const options: JiraDevOpsOption[] = [];
  if (project.jira_project_key) {
    const jira = await getJiraIssuesByProjectKey(project.jira_project_key);
    options.push(
      ...jira.map((o) => ({
        value: `jira:${o.value}`,
        label: o.label,
        url: o.url ?? undefined,
      }))
    );
  }
  if (project.devops_project) {
    const devops = await getDevOpsWorkItemsByProject(project.devops_project);
    options.push(...devops.map((o) => ({ value: `devops:${o.value}`, label: o.label })));
  }
  return options;
}

export async function getTaskOptionsForCustomerAndProject(
  customerId: string,
  projectId?: string
): Promise<TaskOption[]> {
  if (!customerId) return [];
  if (projectId) {
    const roles = await getRolesWithRateForAllocation(projectId, customerId);
    return roles.map((r) => ({ value: r.id, label: r.name }));
  }
  const rates = await getCustomerRates(customerId);
  const roleIds = [...new Set(rates.map((r) => r.role_id))];
  if (roleIds.length === 0) return [];
  const supabase = await createClient();
  const { data: roles, error } = await supabase
    .from("roles")
    .select("id,name")
    .in("id", roleIds)
    .order("name");
  if (error || !roles) return [];
  return roles.map((r) => ({ value: r.id, label: r.name }));
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

export async function getTimeReportEntries(
  consultantId: string,
  year: number,
  week: number
): Promise<TimeReportCustomerGroup[]> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) return [];

  const supabase = await createClient();
  const weekDates = getISOWeekDateStrings(year, week);

  const { data: rows, error } = await supabase
    .from("time_report_entries")
    .select(
      "id, customer_id, project_id, role_id, jira_devops_key, description, entry_date, hours, comment, rate_snapshot, display_order"
    )
    .eq("consultant_id", consultantId)
    .in("entry_date", weekDates)
    .order("display_order", { ascending: true })
    .order("entry_date", { ascending: true });

  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  type Row = (typeof rows)[0];
  const groupKey = (r: Row) =>
    `${r.customer_id}|${r.project_id}|${r.role_id}|${r.jira_devops_key ?? ""}`;
  const byGroup = new Map<string, Row[]>();
  for (const r of rows) {
    const key = groupKey(r);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(r);
  }

  const byCustomer = new Map<string, { key: string; dayRows: Row[] }[]>();
  for (const [, dayRows] of byGroup) {
    const first = dayRows[0];
    const customerId = first.customer_id;
    if (!byCustomer.has(customerId)) byCustomer.set(customerId, []);
    byCustomer.get(customerId)!.push({ key: groupKey(first), dayRows });
  }

  const result: TimeReportCustomerGroup[] = [];
  for (const [customerId, groups] of byCustomer) {
    groups.sort((a, b) => {
      const orderA = a.dayRows[0]?.display_order ?? 0;
      const orderB = b.dayRows[0]?.display_order ?? 0;
      return orderA - orderB;
    });
    const entries: TimeReportEntry[] = groups.map(({ dayRows }) => {
      const hours: number[] = [0, 0, 0, 0, 0, 0, 0];
      const comments: Record<number, string> = {};
      for (const row of dayRows) {
        const dayIndex = weekDates.indexOf(row.entry_date);
        if (dayIndex >= 0) {
          hours[dayIndex] = Number(row.hours ?? 0);
          if (row.comment) comments[dayIndex] = row.comment;
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

export async function saveTimeReportEntries(
  consultantId: string,
  year: number,
  week: number,
  customerGroups: TimeReportCustomerGroup[]
): Promise<{ error?: string }> {
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();
  const weekDates = getISOWeekDateStrings(year, week);

  const { error: deleteError } = await supabase
    .from("time_report_entries")
    .delete()
    .eq("consultant_id", consultantId)
    .in("entry_date", weekDates);

  if (deleteError) return { error: deleteError.message };

  const rows: {
    consultant_id: string;
    customer_id: string;
    project_id: string;
    role_id: string;
    jira_devops_key: string | null;
    description: string | null;
    entry_date: string;
    hours: number;
    comment: string | null;
    rate_snapshot: number | null;
    display_order: number;
  }[] = [];

  const projectIds = new Set<string>();
  const customerIds = new Set<string>();
  for (const group of customerGroups) {
    customerIds.add(group.customerId);
    for (const entry of group.entries) {
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
            comment: comment || null,
            rate_snapshot: rateSnapshot,
            display_order: displayOrder,
          });
        }
      }
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("time_report_entries").insert(rows);
    if (error) return { error: error.message };
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
  const consultant = await getConsultantForCurrentUser();
  if (!consultant || consultant.id !== consultantId) {
    return { error: "Unauthorized" };
  }
  if (!entry.projectId || !entry.roleId) {
    return { error: "Project and Role are required." };
  }

  const supabase = await createClient();
  const weekDates = getISOWeekDateStrings(targetYear, targetWeek);

  const { data: existing } = await supabase
    .from("time_report_entries")
    .select("display_order")
    .eq("consultant_id", consultantId)
    .in("entry_date", weekDates);

  const maxOrder =
    existing?.length && existing.every((r) => r.display_order != null)
      ? Math.max(...existing.map((r) => Number(r.display_order)))
      : 0;
  const displayOrder = maxOrder + 1000;

  const rateSnapshot = await getEffectiveRateSnapshot(
    entry.projectId,
    customerId,
    entry.roleId
  );

  const rows: {
    consultant_id: string;
    customer_id: string;
    project_id: string;
    role_id: string;
    jira_devops_key: string | null;
    description: string | null;
    entry_date: string;
    hours: number;
    comment: string | null;
    rate_snapshot: number | null;
    display_order: number;
  }[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const hours = entry.hours[dayIndex] ?? 0;
    const comment = entry.comments[dayIndex]?.trim() ?? "";
    if (hours > 0 || comment !== "") {
      rows.push({
        consultant_id: consultantId,
        customer_id: customerId,
        project_id: entry.projectId,
        role_id: entry.roleId,
        jira_devops_key: entry.jiraDevOpsValue || null,
        description: (entry.task ?? "").trim() || null,
        entry_date: weekDates[dayIndex],
        hours,
        comment: comment || null,
        rate_snapshot: rateSnapshot,
        display_order: displayOrder,
      });
    }
  }

  if (rows.length === 0) {
    return { error: "Entry has no hours or comments to copy." };
  }

  const { error } = await supabase.from("time_report_entries").insert(rows);
  if (error) return { error: error.message };
  return {};
}
