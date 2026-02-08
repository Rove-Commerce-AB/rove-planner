import { supabase } from "./supabaseClient";
import { getCustomers } from "./customers";
import { getCustomerIdsForConsultant } from "./customerConsultants";
import { getAllocationsByProjectIds } from "./allocations";
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
  start_date: string | null;
  end_date: string | null;
};

export type CreateProjectInput = {
  name: string;
  customer_id: string;
  is_active?: boolean;
  type?: ProjectType;
  start_date?: string | null;
  end_date?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  customer_id?: string;
  is_active?: boolean;
  type?: ProjectType;
  start_date?: string | null;
  end_date?: string | null;
};

export async function createProject(
  input: CreateProjectInput
): Promise<ProjectRecord> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name: input.name.trim(),
      customer_id: input.customer_id,
      is_active: input.is_active ?? true,
      type: input.type ?? "customer",
      start_date: input.start_date?.trim() || null,
      end_date: input.end_date?.trim() || null,
    })
    .select("id,customer_id,name,is_active,type,start_date,end_date")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.customer_id !== undefined) updates.customer_id = input.customer_id;
  if (input.is_active !== undefined) updates.is_active = input.is_active;
  if (input.type !== undefined) updates.type = input.type;
  if (input.start_date !== undefined)
    updates.start_date = input.start_date?.trim() || null;
  if (input.end_date !== undefined)
    updates.end_date = input.end_date?.trim() || null;

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select("id,customer_id,name,is_active,type,start_date,end_date")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Update returned no data");
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) throw error;
}

export async function getProjectWithDetailsById(
  id: string
): Promise<ProjectWithDetails | null> {
  const [project, customers] = await Promise.all([
    supabase
      .from("projects")
      .select("id,customer_id,name,is_active,type,start_date,end_date")
      .eq("id", id)
      .single(),
    getCustomers(),
  ]);

  if (project.error || !project.data) return null;
  const p = project.data;
  const projectType = (p.type as ProjectType) ?? "customer";

  const customerMap = new Map(
    customers.map((c) => [
      c.id,
      { name: c.name, color: c.color || DEFAULT_CUSTOMER_COLOR },
    ])
  );
  const cust = customerMap.get(p.customer_id);

  return {
    id: p.id,
    name: p.name,
    isActive: p.is_active,
    type: projectType,
    customer_id: p.customer_id ?? "",
    customerName: cust?.name ?? "Unknown",
    startDate: p.start_date ?? null,
    endDate: p.end_date ?? null,
    consultantCount: 0,
    totalHoursAllocated: 0,
    consultantInitials: [],
    color: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
  };
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,customer_id,name,is_active,type,start_date,end_date")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function getProjectsWithDetails(): Promise<ProjectWithDetails[]> {
  const [projects, customers] = await Promise.all([
    getProjects(),
    getCustomers(),
  ]);

  if (projects.length === 0) return [];

  const customerMap = new Map(
    customers.map((c) => [
      c.id,
      { name: c.name, color: c.color || DEFAULT_CUSTOMER_COLOR },
    ])
  );

  let allocations: Awaited<ReturnType<typeof getAllocationsByProjectIds>> = [];
  try {
    allocations = await getAllocationsByProjectIds(projects.map((p) => p.id));
  } catch {
    // Allocations table may not exist yet
  }

  const consultantIds = [...new Set(allocations.map((a) => a.consultant_id))];
  let consultants: { id: string; name: string }[] = [];
  try {
    const { data } = await supabase
      .from("consultants")
      .select("id,name")
      .in("id", consultantIds);
    consultants = data ?? [];
  } catch {
    // Consultants table may not exist
  }
  const consultantMap = new Map(
    consultants.map((c) => [c.id, getInitials(c.name)])
  );

  const byProject = new Map<
    string,
    { totalHours: number; consultantIds: Set<string> }
  >();
  for (const a of allocations) {
    const existing = byProject.get(a.project_id) ?? {
      totalHours: 0,
      consultantIds: new Set<string>(),
    };
    existing.totalHours += a.hours;
    existing.consultantIds.add(a.consultant_id);
    byProject.set(a.project_id, existing);
  }

  return projects.map((p, i) => {
    const stats = byProject.get(p.id);
    const consultantIdsList = stats
      ? Array.from(stats.consultantIds)
      : [];
    const initials = consultantIdsList
      .map((id) => consultantMap.get(id) ?? "?")
      .filter(Boolean);

    const cust = customerMap.get(p.customer_id);
    const projectType = (p.type as ProjectType) ?? "customer";
    return {
      id: p.id,
      name: p.name,
      isActive: p.is_active,
      type: projectType,
      customer_id: p.customer_id,
      customerName: cust?.name ?? "Unknown",
      startDate: p.start_date ?? null,
      endDate: p.end_date ?? null,
      consultantCount: consultantIdsList.length,
      totalHoursAllocated: stats?.totalHours ?? 0,
      consultantInitials: initials,
      color: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
    };
  });
}

export async function getProjectsByCustomerIds(
  customerIds: string[]
): Promise<ProjectRecord[]> {
  if (customerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("id,customer_id,name,is_active,type,start_date,end_date")
    .in("customer_id", customerIds);

  if (error) throw error;
  return data ?? [];
}

export async function getProjectsByIds(
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

export type ProjectWithCustomer = {
  id: string;
  name: string;
  customer_id: string;
  customerName: string;
  customerColor: string;
  type: ProjectType;
  isActive: boolean;
  customerIsActive: boolean;
};

export async function getProjectsWithCustomer(
  ids: string[] = []
): Promise<ProjectWithCustomer[]> {
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id,name,customer_id,type,is_active")
    .order("name");

  if (projErr) throw projErr;
  const list = projects ?? [];

  const filtered = ids.length > 0 ? list.filter((p) => ids.includes(p.id)) : list;
  if (filtered.length === 0) return [];

  const customerIds = [...new Set(filtered.map((p) => p.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id,name,color,is_active")
    .in("id", customerIds);
  const customerMap = new Map(
    (customers ?? []).map((c) => [
      c.id,
      {
        name: c.name,
        color: c.color || DEFAULT_CUSTOMER_COLOR,
        is_active: c.is_active ?? true,
      },
    ])
  );

  return filtered.map((p) => {
    const cust = customerMap.get(p.customer_id);
    return {
      id: p.id,
      name: p.name,
      customer_id: p.customer_id,
      customerName: cust?.name ?? "Unknown",
      customerColor: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
      type: (p.type ?? "customer") as ProjectType,
      isActive: p.is_active ?? true,
      customerIsActive: cust?.is_active ?? true,
    };
  });
}

/**
 * Projects to show in Add Allocation modal.
 * - If consultantId is null/empty: all projects (with vertical scroll in UI).
 * - If consultantId is set: only projects belonging to customers that have this consultant assigned.
 */
export async function getProjectsAvailableForConsultant(
  consultantId: string | null
): Promise<ProjectWithCustomer[]> {
  if (!consultantId) return getProjectsWithCustomer();

  const customerIds = await getCustomerIdsForConsultant(consultantId);
  if (customerIds.length === 0) return [];

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id,name,customer_id,type")
    .in("customer_id", customerIds)
    .order("name");

  if (projErr || !projects?.length) return [];

  const { data: customers } = await supabase
    .from("customers")
    .select("id,name,color")
    .in("id", [...new Set(projects.map((p) => p.customer_id))]);

  const customerMap = new Map(
    (customers ?? []).map((c) => [
      c.id,
      {
        name: c.name,
        color: c.color || DEFAULT_CUSTOMER_COLOR,
      },
    ])
  );

  return projects.map((p) => {
    const cust = customerMap.get(p.customer_id);
    return {
      id: p.id,
      name: p.name,
      customer_id: p.customer_id,
      customerName: cust?.name ?? "Unknown",
      customerColor: cust?.color ?? DEFAULT_CUSTOMER_COLOR,
      type: (p.type ?? "customer") as ProjectType,
    };
  });
}
