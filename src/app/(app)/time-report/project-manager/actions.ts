"use server";

import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantForCurrentUser } from "@/lib/consultants";
import { createClient } from "@/lib/supabase/server";

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const toYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  return { start: toYMD(start), end: toYMD(end) };
}

export type ProjectManagerEntry = {
  id: string;
  entryDate: string;
  consultantId: string;
  consultantName: string;
  customerId: string;
  customerName: string;
  projectId: string;
  task: string;
  jiraDevOpsKey: string | null;
  jiraKey: string | null;
  jiraTitle: string | null;
  hours: number;
  comment: string | null;
  pmEditedHours: number | null;
  pmEditedComment: string | null;
  invoicedAt: string | null;
};

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
      (rows ?? [])
        .map((r: any) => r.jira_devops_key as unknown)
        .filter((v): v is string => typeof v === "string" && v.startsWith("jira:"))
        .map((v) => v.slice(5))
    ),
  ];

  const [consultantsRes, customersRes, jiraRes] = await Promise.all([
    consultantIds.length
      ? supabase
          .from("consultants")
          .select("id,name")
          .in("id", consultantIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase
          .from("customers")
          .select("id,name")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    jiraKeys.length
      ? supabase
          .from("jira_issues")
          .select("jira_key, summary")
          .in("jira_key", jiraKeys)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const consultantMap = new Map(
    (consultantsRes.data ?? []).map((c: any) => [c.id, c.name ?? "Unknown"])
  );
  const customerMap = new Map(
    (customersRes.data ?? []).map((c: any) => [c.id, c.name ?? "Unknown"])
  );
  const jiraMap = new Map(
    (jiraRes.data ?? []).map((j: any) => [j.jira_key, j.summary ?? null])
  );

  const entries: ProjectManagerEntry[] = rows.map((r: any) => ({
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
  /** When omitted, pm_edited_hours is not modified (useful when editing comment only). */
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
    // Project managers should only be able to edit hours/comments, not mark entries for invoicing.
    return { ok: false, error: "Not authorized to mark for invoicing" };
  }

  const comment = args.pmComment.trim() === "" ? null : args.pmComment.trim();
  const pmEditedAt = new Date().toISOString();

  const updates: any = {
    pm_edited_comment: comment,
    pm_edited_at: pmEditedAt,
  };
  // If pmHours is provided (including null), update pm_edited_hours accordingly.
  // - null => clear pm_edited_hours
  // - number => set pm_edited_hours
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

  // Ensure we have an existing row (useful for nicer errors / RLS edge cases)
  const { data: entry, error: entryErr } = await supabase
    .from("time_report_entries")
    .select("id, project_id")
    .eq("id", args.entryId)
    .single();

  if (entryErr || !entry) return { ok: false, error: "Entry not found" };

  const { data: managed } = await supabase
    .from("projects")
    .select("id")
    .eq("id", (entry as any).project_id)
    .eq("project_manager_id", consultant.id)
    .limit(1);
  if (!managed || managed.length === 0) return { ok: false, error: "Unauthorized" };

  const updates: any = {
    pm_edited_at: pmEditedAt,
  };
  if (consultant?.id) updates.pm_edited_by = consultant.id;

  updates.invoiced_at = args.ready ? pmEditedAt : null;

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

  // Ensure all requested entries belong to projects managed by current consultant.
  const { data: entries, error: entriesErr } = await supabase
    .from("time_report_entries")
    .select("id, project_id")
    .in("id", args.entryIds);
  if (entriesErr) return { ok: false, error: entriesErr.message };
  const projectIds = [...new Set((entries ?? []).map((r: any) => r.project_id).filter(Boolean))];
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
  const updates: any = {
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

