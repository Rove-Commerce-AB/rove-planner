import type { SupabaseClient } from "@supabase/supabase-js";

import * as allocations from "./allocationsQueries";
import * as cc from "./customerConsultantsQueries";
import * as customers from "./customersQueries";
import * as consultants from "./consultantsQueries";
import { DEFAULT_CUSTOMER_COLOR } from "./constants";
import type { ProjectWithDetails, ProjectType } from "@/types";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export type ProjectRecord = {
  id: string;
  customer_id: string;
  name: string;
  is_active: boolean;
  type: ProjectType;
  project_manager_id: string | null;
  start_date: string | null;
  end_date: string | null;
  probability: number | null;
  jira_project_key: string | null;
  devops_project: string | null;
  budget_hours: number | null;
  budget_money: number | null;
};

export type CreateProjectInput = {
  name: string;
  customer_id: string;
  is_active?: boolean;
  type?: ProjectType;
  project_manager_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  probability?: number | null;
  jira_project_key?: string | null;
  devops_project?: string | null;
  budget_hours?: number | null;
  budget_money?: number | null;
};

export type UpdateProjectInput = {
  name?: string;
  customer_id?: string;
  is_active?: boolean;
  type?: ProjectType;
  project_manager_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  probability?: number | null;
  jira_project_key?: string | null;
  devops_project?: string | null;
  budget_hours?: number | null;
  budget_money?: number | null;
};

const PROJECT_SELECT =
  "id,customer_id,name,is_active,type,project_manager_id,start_date,end_date,probability,jira_project_key,devops_project,budget_hours,budget_money";

export async function createProjectQuery(
  supabase: SupabaseClient,
  input: CreateProjectInput
): Promise<ProjectRecord> {
  const prob = input.probability ?? 100;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name.trim(),
      customer_id: input.customer_id,
      is_active: input.is_active ?? true,
      type: input.type ?? "customer",
      project_manager_id: input.project_manager_id ?? null,
      start_date: input.start_date?.trim() || null,
      end_date: input.end_date?.trim() || null,
      probability: prob,
      jira_project_key: input.jira_project_key?.trim() || null,
      devops_project: input.devops_project?.trim() || null,
      budget_hours: input.budget_hours ?? null,
      budget_money: input.budget_money ?? null,
    })
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;
  return data as ProjectRecord;
}

export async function updateProjectQuery(
  supabase: SupabaseClient,
  id: string,
  input: UpdateProjectInput
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.customer_id !== undefined) updates.customer_id = input.customer_id;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.type !== undefined) updates.type = input.type;
  if (input.project_manager_id !== undefined)
    updates.project_manager_id = input.project_manager_id ?? null;
  if (input.start_date !== undefined)
    updates.start_date = input.start_date?.trim() || null;
  if (input.end_date !== undefined)
    updates.end_date = input.end_date?.trim() || null;
  if (input.probability !== undefined) updates.probability = input.probability;
  if (input.jira_project_key !== undefined)
    updates.jira_project_key = input.jira_project_key?.trim() || null;
  if (input.devops_project !== undefined)
    updates.devops_project = input.devops_project?.trim() || null;
  if (input.budget_hours !== undefined)
    updates.budget_hours = input.budget_hours ?? null;
  if (input.budget_money !== undefined)
    updates.budget_money = input.budget_money ?? null;

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Update returned no data");
}

export async function deleteProjectQuery(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) throw error;
}

export type IntegrationProjectOption = { value: string; label: string };

export async function fetchUniqueJiraAndDevopsProjects(
  supabase: SupabaseClient
): Promise<IntegrationProjectOption[]> {
  const [jiraRes, devopsRes] = await Promise.all([
    supabase.rpc("get_distinct_jira_projects"),
    supabase.rpc("get_distinct_devops_projects"),
  ]);

  const jiraOptions: IntegrationProjectOption[] = (jiraRes.data ?? []).map(
    (row: { project_key: string; project_name: string | null }) => {
      const key = row.project_key?.trim() ?? "";
      const name = (row.project_name ?? key).trim();
      return {
        value: `jira:${key}`,
        label: `Jira: ${key}${name && name !== key ? ` (${name})` : ""}`,
      };
    }
  );

  const devopsOptions: IntegrationProjectOption[] = (devopsRes.data ?? []).map(
    (row: { project: string }) => {
      const p = (row.project ?? "").trim();
      return { value: `devops:${p}`, label: `DevOps: ${p}` };
    }
  );

  return [{ value: "", label: "—" }, ...jiraOptions, ...devopsOptions];
}

export async function fetchProjectWithDetailsById(
  supabase: SupabaseClient,
  id: string
): Promise<ProjectWithDetails | null> {
  const [project, customersList] = await Promise.all([
    supabase.from("projects").select(PROJECT_SELECT).eq("id", id).single(),
    customers.fetchCustomers(supabase),
  ]);

  if (project.error || !project.data) return null;
  const p = project.data;
  const projectType = (p.type as ProjectType) ?? "customer";

  const customerMap = new Map(
    customersList.map((c) => [
      c.id,
      {
        name: c.name,
        color: c.color || DEFAULT_CUSTOMER_COLOR,
      },
    ])
  );
  const cust = customerMap.get(p.customer_id);
  const projectManagerId = p.project_manager_id ?? null;
  const projectManagerNames = projectManagerId
    ? await consultants.fetchConsultantNamesByIds(supabase, [projectManagerId])
    : new Map<string, string>();
  const projectManagerName = projectManagerId
    ? projectManagerNames.get(projectManagerId) ?? null
    : null;

  const probability = p.probability != null ? p.probability : 100;
  return {
    id: p.id,
    name: p.name,
    isActive: p.is_active,
    type: projectType,
    customer_id: p.customer_id ?? "",
    customerName: cust?.name ?? "Unknown",
    projectManagerId,
    projectManagerName,
    startDate: p.start_date ?? null,
    endDate: p.end_date ?? null,
    probability,
    jiraProjectKey: p.jira_project_key ?? null,
    devopsProject: p.devops_project ?? null,
    budgetHours: p.budget_hours != null ? Number(p.budget_hours) : null,
    budgetMoney: p.budget_money != null ? Number(p.budget_money) : null,
    consultantCount: 0,
    totalHoursAllocated: 0,
    consultantInitials: [],
    color: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
  };
}

export async function fetchProjects(
  supabase: SupabaseClient
): Promise<ProjectRecord[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .order("is_active", { ascending: false })
    .order("name");

  if (error) throw error;
  return (data ?? []) as ProjectRecord[];
}

export async function fetchProjectsWithDetails(
  supabase: SupabaseClient
): Promise<ProjectWithDetails[]> {
  const [projects, customersList] = await Promise.all([
    fetchProjects(supabase),
    customers.fetchCustomers(supabase),
  ]);

  if (projects.length === 0) return [];

  const customerMap = new Map(
    customersList.map((c) => [
      c.id,
      {
        name: c.name,
        color: c.color || DEFAULT_CUSTOMER_COLOR,
      },
    ])
  );

  const projectManagerIds = [
    ...new Set(projects.map((p) => p.project_manager_id).filter(Boolean)),
  ] as string[];
  let projectManagerNames = new Map<string, string>();
  try {
    projectManagerNames = await consultants.fetchConsultantNamesByIds(
      supabase,
      projectManagerIds
    );
  } catch {
    // optional field
  }

  let allocationRows: Awaited<
    ReturnType<typeof allocations.getAllocationsByProjectIds>
  > = [];
  try {
    allocationRows = await allocations.getAllocationsByProjectIds(
      supabase,
      projects.map((p) => p.id)
    );
  } catch {
    // Allocations table may not exist yet
  }

  const consultantIds = [
    ...new Set(
      allocationRows.map((a) => a.consultant_id).filter((id): id is string => id != null)
    ),
  ];
  let consultantRows: { id: string; name: string }[] = [];
  try {
    const { data } = await supabase
      .from("consultants")
      .select("id,name")
      .in("id", consultantIds);
    consultantRows = data ?? [];
  } catch {
    // Consultants table may not exist
  }
  const consultantMap = new Map(
    consultantRows.map((c) => [c.id, getInitials(c.name)])
  );
  const byProject = new Map<
    string,
    { totalHours: number; consultantIds: Set<string | null> }
  >();
  for (const a of allocationRows) {
    const existing = byProject.get(a.project_id) ?? {
      totalHours: 0,
      consultantIds: new Set<string | null>(),
    };
    existing.totalHours += a.hours;
    existing.consultantIds.add(a.consultant_id);
    byProject.set(a.project_id, existing);
  }

  return projects.map((p) => {
    const stats = byProject.get(p.id);
    const consultantIdsList = stats
      ? Array.from(stats.consultantIds)
      : [];
    const initials = consultantIdsList
      .map((id) => (id == null ? "TP" : consultantMap.get(id) ?? "?"))
      .filter(Boolean);

    const cust = customerMap.get(p.customer_id);
    const projectManagerId = p.project_manager_id ?? null;
    const projectType = (p.type as ProjectType) ?? "customer";
    const probability = p.probability != null ? p.probability : 100;
    return {
      id: p.id,
      name: p.name,
      isActive: p.is_active,
      type: projectType,
      customer_id: p.customer_id,
      customerName: cust?.name ?? "Unknown",
      projectManagerId,
      projectManagerName: projectManagerId
        ? projectManagerNames.get(projectManagerId) ?? null
        : null,
      startDate: p.start_date ?? null,
      endDate: p.end_date ?? null,
      probability,
      jiraProjectKey: p.jira_project_key ?? null,
      devopsProject: p.devops_project ?? null,
      budgetHours: p.budget_hours != null ? Number(p.budget_hours) : null,
      budgetMoney: p.budget_money != null ? Number(p.budget_money) : null,
      consultantCount: consultantIdsList.length,
      totalHoursAllocated: stats?.totalHours ?? 0,
      consultantInitials: initials,
      color: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
    };
  });
}

export async function fetchProjectsByCustomerIds(
  supabase: SupabaseClient,
  customerIds: string[]
): Promise<ProjectRecord[]> {
  if (customerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .in("customer_id", customerIds);

  if (error) throw error;
  return (data ?? []) as ProjectRecord[];
}

export async function fetchProjectsByIds(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", ids);

  if (error) throw error;
  return data ?? [];
}

export async function fetchProjectsWithCustomerNames(
  supabase: SupabaseClient,
  ids: string[]
): Promise<{ id: string; name: string; customerName: string }[]> {
  if (ids.length === 0) return [];
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id,name,customer_id")
    .in("id", ids);
  if (projErr || !projects?.length) return [];
  const customerIds = [...new Set(projects.map((p) => p.customer_id).filter(Boolean))];
  const { data: customersData } = await supabase
    .from("customers")
    .select("id,name")
    .in("id", customerIds);
  const customerMap = new Map((customersData ?? []).map((c) => [c.id, c.name]));
  return projects.map((p) => ({
    id: p.id,
    name: p.name ?? "Unknown",
    customerName: customerMap.get(p.customer_id) ?? "Unknown",
  }));
}

export type ProjectWithCustomer = {
  id: string;
  name: string;
  customer_id: string;
  customerName: string;
  customerColor: string;
  type: ProjectType;
  isActive: boolean;
  customerIsActive: boolean;
  probability: number | null;
};

export async function fetchProjectsWithCustomer(
  supabase: SupabaseClient,
  ids: string[] = []
): Promise<ProjectWithCustomer[]> {
  let projectsQuery = supabase
    .from("projects")
    .select("id,name,customer_id,type,is_active,probability")
    .order("name");
  if (ids.length > 0) {
    projectsQuery = projectsQuery.in("id", ids);
  }
  const { data: projects, error: projErr } = await projectsQuery;

  if (projErr) throw projErr;
  const list = projects ?? [];

  if (list.length === 0) return [];

  const customerIds = [...new Set(list.map((p) => p.customer_id))];
  const { data: customersData } = await supabase
    .from("customers")
    .select("id,name,color,is_active")
    .in("id", customerIds);
  const customerMap = new Map(
    (customersData ?? []).map((c) => [
      c.id,
      {
        name: c.name,
        color: c.color || DEFAULT_CUSTOMER_COLOR,
        is_active: c.is_active ?? true,
      },
    ])
  );

  return list.map((p) => {
    const cust = customerMap.get(p.customer_id);
    const probability = p.probability != null ? p.probability : 100;
    return {
      id: p.id,
      name: p.name,
      customer_id: p.customer_id,
      customerName: cust?.name ?? "Unknown",
      customerColor: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
      type: (p.type ?? "customer") as ProjectType,
      isActive: p.is_active ?? true,
      customerIsActive: cust?.is_active ?? true,
      probability,
    };
  });
}

export async function fetchProjectsAvailableForConsultant(
  supabase: SupabaseClient,
  consultantId: string | null
): Promise<ProjectWithCustomer[]> {
  if (!consultantId) return fetchProjectsWithCustomer(supabase, []);

  const customerIds = await cc.getCustomerIdsForConsultant(
    supabase,
    consultantId
  );
  if (customerIds.length === 0) return [];

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id,name,customer_id,type,is_active,probability")
    .in("customer_id", customerIds)
    .order("name");

  if (projErr || !projects?.length) return [];

  const { data: customersData } = await supabase
    .from("customers")
    .select("id,name,color,is_active")
    .in("id", [...new Set(projects.map((p) => p.customer_id))]);

  const customerMap = new Map(
    (customersData ?? []).map((c) => [
      c.id,
      {
        name: c.name,
        color: c.color || DEFAULT_CUSTOMER_COLOR,
        is_active: c.is_active ?? true,
      },
    ])
  );

  return projects.map((p) => {
    const cust = customerMap.get(p.customer_id);
    const probability = p.probability != null ? p.probability : 100;
    return {
      id: p.id,
      name: p.name,
      customer_id: p.customer_id,
      customerName: cust?.name ?? "Unknown",
      customerColor: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
      type: (p.type ?? "customer") as ProjectType,
      isActive: p.is_active ?? true,
      customerIsActive: cust?.is_active ?? true,
      probability,
    };
  });
}
