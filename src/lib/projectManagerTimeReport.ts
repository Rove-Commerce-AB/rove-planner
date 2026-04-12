import "server-only";

import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import type { ProjectManagerEntry } from "@/types";

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { start: toYMD(start), end: toYMD(end) };
}

export async function getProjectManagerTimeEntries(args: {
  projectId: string;
  year: number;
  month: number;
}): Promise<{ entries: ProjectManagerEntry[] }> {
  await getCurrentAppUser();
  const consultant = await getConsultantForCurrentUser();
  if (!consultant?.id) return { entries: [] };

  if (!args.projectId) return { entries: [] };

  const monthRange = getMonthRange(args.year, args.month);

  const { rows: managed } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id FROM projects WHERE id = $1 AND project_manager_id = $2 LIMIT 1`,
    [args.projectId, consultant.id]
  );
  if (!managed.length) return { entries: [] };

  const { rows } = await cloudSqlPool.query<{
    id: string;
    entry_date: string;
    consultant_id: string;
    customer_id: string;
    project_id: string;
    role_id: string;
    jira_devops_key: string | null;
    description: string | null;
    hours: string | number;
    internal_comment: string | null;
    pm_edited_hours: string | number | null;
    pm_edited_comment: string | null;
    invoiced_at: string | null;
  }>(
    `SELECT id, entry_date::text AS entry_date, consultant_id, customer_id, project_id, role_id,
            jira_devops_key, description, hours, internal_comment,
            pm_edited_hours, pm_edited_comment, invoiced_at::text AS invoiced_at
     FROM time_report_entries
     WHERE project_id = $1 AND entry_date >= $2::date AND entry_date <= $3::date
     ORDER BY entry_date ASC`,
    [args.projectId, monthRange.start, monthRange.end]
  );

  if (rows.length === 0) return { entries: [] };

  const consultantIds = [...new Set(rows.map((r) => r.consultant_id).filter(Boolean))];
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];

  const jiraKeys = [
    ...new Set(
      rows
        .map((r) => r.jira_devops_key)
        .filter((v): v is string => typeof v === "string" && v.startsWith("jira:"))
        .map((v) => v.slice(5))
    ),
  ];

  const [consultantsRes, customersRes, jiraRes] = await Promise.all([
    consultantIds.length
      ? cloudSqlPool.query<{ id: string; name: string | null }>(
          `SELECT id, name FROM consultants WHERE id = ANY($1::uuid[])`,
          [consultantIds]
        )
      : Promise.resolve({ rows: [] as { id: string; name: string | null }[] }),
    customerIds.length
      ? cloudSqlPool.query<{ id: string; name: string | null }>(
          `SELECT id, name FROM customers WHERE id = ANY($1::uuid[])`,
          [customerIds]
        )
      : Promise.resolve({ rows: [] as { id: string; name: string | null }[] }),
    jiraKeys.length
      ? cloudSqlPool.query<{ jira_key: string; summary: string | null }>(
          `SELECT jira_key, summary FROM jira_issues WHERE jira_key = ANY($1::text[])`,
          [jiraKeys]
        )
      : Promise.resolve({ rows: [] as { jira_key: string; summary: string | null }[] }),
  ]);

  const consultantMap = new Map(
    consultantsRes.rows.map((c) => [c.id, c.name ?? "Unknown"])
  );
  const customerMap = new Map(
    customersRes.rows.map((c) => [c.id, c.name ?? "Unknown"])
  );
  const jiraMap = new Map(
    jiraRes.rows.map((j) => [j.jira_key, j.summary ?? null])
  );

  const entries: ProjectManagerEntry[] = rows.map((r) => ({
    id: r.id,
    entryDate: r.entry_date,
    consultantId: r.consultant_id,
    consultantName: consultantMap.get(r.consultant_id) ?? "Unknown",
    customerId: r.customer_id,
    customerName: customerMap.get(r.customer_id) ?? "Unknown",
    projectId: r.project_id,
    task: r.description ?? "",
    jiraDevOpsKey: r.jira_devops_key ?? null,
    jiraKey:
      typeof r.jira_devops_key === "string" && r.jira_devops_key.startsWith("jira:")
        ? r.jira_devops_key.slice(5)
        : null,
    jiraTitle:
      typeof r.jira_devops_key === "string" && r.jira_devops_key.startsWith("jira:")
        ? jiraMap.get(r.jira_devops_key.slice(5)) ?? null
        : null,
    hours: Number(r.hours ?? 0),
    internalComment: r.internal_comment ?? null,
    pmEditedHours: r.pm_edited_hours != null ? Number(r.pm_edited_hours) : null,
    pmEditedComment: r.pm_edited_comment ?? null,
    invoicedAt: r.invoiced_at ? String(r.invoiced_at) : null,
  }));

  return { entries };
}

export async function pmUpdateTimeEntry(args: {
  entryId: string;
  pmHours?: number | null;
  pmComment: string;
  markInvoicing: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";
  const consultant = await getConsultantForCurrentUser();
  if (!consultant?.id) return { ok: false, error: "Unauthorized" };

  const { rows: entryRows } = await cloudSqlPool.query<{
    id: string;
    project_id: string;
    invoiced_at: string | null;
  }>(
    `SELECT id, project_id, invoiced_at::text FROM time_report_entries WHERE id = $1`,
    [args.entryId]
  );
  const entry = entryRows[0];
  if (!entry) return { ok: false, error: "Entry not found" };

  const { rows: managed } = await cloudSqlPool.query(
    `SELECT id FROM projects WHERE id = $1 AND project_manager_id = $2 LIMIT 1`,
    [entry.project_id, consultant.id]
  );
  if (!managed.length) return { ok: false, error: "Unauthorized" };

  if (entry.invoiced_at && !isAdmin) {
    return { ok: false, error: "Already marked for invoicing" };
  }
  if (args.markInvoicing && !isAdmin) {
    return { ok: false, error: "Not authorized to mark for invoicing" };
  }

  const comment = args.pmComment.trim() === "" ? null : args.pmComment.trim();
  const pmEditedAt = new Date().toISOString();

  const sets: string[] = [
    "pm_edited_comment = $2",
    "pm_edited_at = $3::timestamptz",
    "pm_edited_by = $4",
  ];
  const values: unknown[] = [args.entryId, comment, pmEditedAt, consultant.id];
  let i = 5;
  if (args.pmHours !== undefined) {
    sets.push(`pm_edited_hours = $${i++}`);
    values.push(args.pmHours);
  }
  if (args.markInvoicing) {
    sets.push(`invoiced_at = $${i++}::timestamptz`);
    values.push(pmEditedAt);
  }

  try {
    await cloudSqlPool.query(
      `UPDATE time_report_entries SET ${sets.join(", ")} WHERE id = $1`,
      values
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
  return { ok: true };
}

export async function pmSetInvoicingStatus(args: {
  entryId: string;
  ready: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";
  if (!isAdmin) return { ok: false, error: "Not authorized" };

  const consultant = await getConsultantForCurrentUser();
  if (!consultant?.id) return { ok: false, error: "Unauthorized" };

  const pmEditedAt = new Date().toISOString();

  const { rows: entryRows } = await cloudSqlPool.query<{ id: string; project_id: string }>(
    `SELECT id, project_id FROM time_report_entries WHERE id = $1`,
    [args.entryId]
  );
  const entry = entryRows[0];
  if (!entry) return { ok: false, error: "Entry not found" };

  const { rows: managed } = await cloudSqlPool.query(
    `SELECT id FROM projects WHERE id = $1 AND project_manager_id = $2 LIMIT 1`,
    [entry.project_id, consultant.id]
  );
  if (!managed.length) return { ok: false, error: "Unauthorized" };

  try {
    await cloudSqlPool.query(
      `UPDATE time_report_entries
       SET pm_edited_at = $2::timestamptz,
           invoiced_at = CASE WHEN $3 THEN $2::timestamptz ELSE NULL END,
           pm_edited_by = $4
       WHERE id = $1`,
      [args.entryId, pmEditedAt, args.ready, consultant.id]
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
  return { ok: true };
}

export async function pmSetInvoicingStatusBulk(args: {
  entryIds: string[];
  ready: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";
  if (!isAdmin) return { ok: false, error: "Not authorized" };

  const consultant = await getConsultantForCurrentUser();
  if (!consultant?.id) return { ok: false, error: "Unauthorized" };

  if (!args.entryIds.length) return { ok: true };

  const { rows: entries } = await cloudSqlPool.query<{ id: string; project_id: string }>(
    `SELECT id, project_id FROM time_report_entries WHERE id = ANY($1::uuid[])`,
    [args.entryIds]
  );
  const projectIds = [...new Set(entries.map((r) => r.project_id).filter(Boolean))];
  if (projectIds.length === 0) return { ok: false, error: "No entries found" };

  const { rows: managedProjects } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id FROM projects WHERE id = ANY($1::uuid[]) AND project_manager_id = $2`,
    [projectIds, consultant.id]
  );
  if (managedProjects.length !== projectIds.length) {
    return { ok: false, error: "Unauthorized" };
  }

  const pmEditedAt = new Date().toISOString();

  try {
    await cloudSqlPool.query(
      `UPDATE time_report_entries
       SET pm_edited_at = $1::timestamptz,
           invoiced_at = CASE WHEN $2 THEN $1::timestamptz ELSE NULL END,
           pm_edited_by = $3
       WHERE id = ANY($4::uuid[])`,
      [pmEditedAt, args.ready, consultant.id, args.entryIds]
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
  return { ok: true };
}
