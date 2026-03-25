import "server-only";

import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const monthRange = getMonthRange(args.year, args.month);

  const { data: managed } = await supabase
    .from("projects")
    .select("id")
    .eq("id", args.projectId)
    .eq("project_manager_id", consultant.id)
    .limit(1);
  if (!managed || managed.length === 0) return { entries: [] };

  const { data: rows, error } = await supabase
    .from("time_report_entries")
    .select(
      "id, entry_date, consultant_id, customer_id, project_id, role_id, jira_devops_key, description, hours, comment, pm_edited_hours, pm_edited_comment, invoiced_at"
    )
    .eq("project_id", args.projectId)
    .gte("entry_date", monthRange.start)
    .lte("entry_date", monthRange.end)
    .order("entry_date", { ascending: true });

  if (error || !rows) return { entries: [] };

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
      ? supabase.from("consultants").select("id,name").in("id", consultantIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    customerIds.length
      ? supabase.from("customers").select("id,name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
    jiraKeys.length
      ? supabase.from("jira_issues").select("jira_key, summary").in("jira_key", jiraKeys)
      : Promise.resolve({ data: [] as { jira_key: string; summary: string | null }[], error: null }),
  ]);

  const consultantMap = new Map(
    (consultantsRes.data ?? []).map((c) => [c.id, c.name ?? "Unknown"])
  );
  const customerMap = new Map(
    (customersRes.data ?? []).map((c) => [c.id, c.name ?? "Unknown"])
  );
  const jiraMap = new Map(
    (jiraRes.data ?? []).map((j) => [j.jira_key, j.summary ?? null])
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
    comment: r.comment ?? null,
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

  const supabase = await createClient();
  const { data: entry, error: entryErr } = await supabase
    .from("time_report_entries")
    .select("id, project_id, invoiced_at")
    .eq("id", args.entryId)
    .single();

  if (entryErr || !entry) return { ok: false, error: "Entry not found" };
  const { data: managed } = await supabase
    .from("projects")
    .select("id")
    .eq("id", entry.project_id)
    .eq("project_manager_id", consultant.id)
    .limit(1);
  if (!managed || managed.length === 0) return { ok: false, error: "Unauthorized" };

  if (entry.invoiced_at && !isAdmin) {
    return { ok: false, error: "Already marked for invoicing" };
  }
  if (args.markInvoicing && !isAdmin) {
    return { ok: false, error: "Not authorized to mark for invoicing" };
  }

  const comment = args.pmComment.trim() === "" ? null : args.pmComment.trim();
  const pmEditedAt = new Date().toISOString();

  const updates: Record<string, unknown> = {
    pm_edited_comment: comment,
    pm_edited_at: pmEditedAt,
  };
  if (args.pmHours !== undefined) updates.pm_edited_hours = args.pmHours;
  if (consultant?.id) updates.pm_edited_by = consultant.id;

  if (args.markInvoicing) {
    updates.invoiced_at = pmEditedAt;
  }

  const { error: updateErr } = await supabase
    .from("time_report_entries")
    .update(updates)
    .eq("id", args.entryId);

  if (updateErr) return { ok: false, error: updateErr.message };
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
  const supabase = await createClient();

  const pmEditedAt = new Date().toISOString();

  const { data: entry, error: entryErr } = await supabase
    .from("time_report_entries")
    .select("id, project_id")
    .eq("id", args.entryId)
    .single();

  if (entryErr || !entry) return { ok: false, error: "Entry not found" };

  const { data: managed } = await supabase
    .from("projects")
    .select("id")
    .eq("id", entry.project_id)
    .eq("project_manager_id", consultant.id)
    .limit(1);
  if (!managed || managed.length === 0) return { ok: false, error: "Unauthorized" };

  const updates: Record<string, unknown> = {
    pm_edited_at: pmEditedAt,
    invoiced_at: args.ready ? pmEditedAt : null,
  };
  if (consultant?.id) updates.pm_edited_by = consultant.id;

  const { error: updateErr } = await supabase
    .from("time_report_entries")
    .update(updates)
    .eq("id", args.entryId);

  if (updateErr) return { ok: false, error: updateErr.message };
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
  const supabase = await createClient();

  if (!args.entryIds.length) return { ok: true };

  const { data: entries, error: entriesErr } = await supabase
    .from("time_report_entries")
    .select("id, project_id")
    .in("id", args.entryIds);
  if (entriesErr) return { ok: false, error: entriesErr.message };
  const projectIds = [...new Set((entries ?? []).map((r) => r.project_id).filter(Boolean))];
  if (projectIds.length === 0) return { ok: false, error: "No entries found" };

  const { data: managedProjects, error: managedErr } = await supabase
    .from("projects")
    .select("id")
    .in("id", projectIds as string[])
    .eq("project_manager_id", consultant.id);
  if (managedErr) return { ok: false, error: managedErr.message };
  if ((managedProjects?.length ?? 0) !== projectIds.length) {
    return { ok: false, error: "Unauthorized" };
  }

  const pmEditedAt = new Date().toISOString();
  const updates: Record<string, unknown> = {
    pm_edited_at: pmEditedAt,
    invoiced_at: args.ready ? pmEditedAt : null,
  };
  if (consultant?.id) updates.pm_edited_by = consultant.id;

  const { error: updateErr } = await supabase
    .from("time_report_entries")
    .update(updates)
    .in("id", args.entryIds);

  if (updateErr) return { ok: false, error: updateErr.message };
  return { ok: true };
}
