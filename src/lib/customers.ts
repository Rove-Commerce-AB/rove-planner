import { supabase } from "./supabaseClient";
import { getProjectsByCustomerIds } from "./projects";
import { getConsultantNamesByIds } from "./consultants";
import { DEFAULT_CUSTOMER_COLOR } from "./constants";
import type { CustomerWithDetails, ProjectType } from "@/types";

export type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  account_manager_id: string | null;
  color: string | null;
  logo_url: string | null;
  is_active: boolean;
};

export type CreateCustomerInput = {
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  account_manager_id?: string | null;
  color?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
};

export type UpdateCustomerInput = {
  name?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  account_manager_id?: string | null;
  color?: string | null;
  logo_url?: string | null;
  is_active?: boolean;
};


function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function getCustomerById(id: string): Promise<CustomerWithDetails | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,contact_name,contact_email,account_manager_id,color,logo_url,is_active")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const accountManagerNames = data.account_manager_id
    ? await getConsultantNamesByIds([data.account_manager_id])
    : new Map<string, string>();

  let projectsByCustomer = new Map<
    string,
    { id: string; name: string; is_active: boolean; type: string }[]
  >();
  try {
    const projects = await getProjectsByCustomerIds([data.id]);
    for (const p of projects) {
      const list = projectsByCustomer.get(p.customer_id) ?? [];
      list.push({
        id: p.id,
        name: p.name,
        is_active: p.is_active,
        type: p.type ?? "customer",
      });
      projectsByCustomer.set(p.customer_id, list);
    }
  } catch {
    // Projects table may not exist
  }

  const customerProjects = projectsByCustomer.get(data.id) ?? [];
  const activeProjects = customerProjects.filter((p) => p.is_active);
  const primaryProject = customerProjects[0] ?? null;

  return {
    id: data.id,
    name: data.name,
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    accountManagerId: data.account_manager_id ?? null,
    accountManagerName: data.account_manager_id
      ? accountManagerNames.get(data.account_manager_id) ?? null
      : null,
    color: data.color || DEFAULT_CUSTOMER_COLOR,
    logoUrl: data.logo_url ?? null,
    initials: getInitials(data.name),
    isActive: data.is_active ?? true,
    activeProjectCount: activeProjects.length,
    primaryProject: primaryProject
      ? { name: primaryProject.name, isActive: primaryProject.is_active }
      : null,
    projects: customerProjects.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.is_active,
      type: p.type as ProjectType,
    })),
  };
}

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,contact_name,contact_email,account_manager_id,color,logo_url,is_active")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name.trim(),
      contact_name: input.contact_name?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      account_manager_id: input.account_manager_id ?? null,
      color: input.color?.trim() || DEFAULT_CUSTOMER_COLOR,
      logo_url: input.logo_url?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select("id,name,contact_name,contact_email,account_manager_id,color,logo_url,is_active")
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .update({
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.contact_name !== undefined && {
        contact_name: input.contact_name?.trim() || null,
      }),
      ...(input.contact_email !== undefined && {
        contact_email: input.contact_email?.trim() || null,
      }),
      ...(input.account_manager_id !== undefined && {
        account_manager_id: input.account_manager_id ?? null,
      }),
      ...(input.color !== undefined && {
        color: input.color?.trim() || DEFAULT_CUSTOMER_COLOR,
      }),
      ...(input.logo_url !== undefined && {
        logo_url: input.logo_url?.trim() || null,
      }),
      ...(input.is_active !== undefined && { is_active: input.is_active }),
    })
    .eq("id", id)
    .select("id,name,contact_name,contact_email,account_manager_id,color,logo_url,is_active")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) throw error;
}

/**
 * Returns customers with project counts and primary project for card display.
 * Data from customers table + projects table. Handles missing projects table.
 */
export async function getCustomersWithDetails(): Promise<CustomerWithDetails[]> {
  const customers = await getCustomers();

  const accountManagerIds = [...new Set(customers.map((c) => c.account_manager_id).filter(Boolean))] as string[];
  const accountManagerNames = await getConsultantNamesByIds(accountManagerIds);

  let projectsByCustomer = new Map<
    string,
    { id: string; name: string; is_active: boolean; type: string }[]
  >();
  try {
    const projects = await getProjectsByCustomerIds(customers.map((c) => c.id));
    for (const p of projects) {
      const list = projectsByCustomer.get(p.customer_id) ?? [];
      list.push({
        id: p.id,
        name: p.name,
        is_active: p.is_active,
        type: p.type ?? "customer",
      });
      projectsByCustomer.set(p.customer_id, list);
    }
  } catch {
    // Projects table may not exist yet
  }

  return customers.map((c) => {
    const customerProjects = projectsByCustomer.get(c.id) ?? [];
    const activeProjects = customerProjects.filter((p) => p.is_active);
    const primaryProject = customerProjects[0] ?? null;

    return {
      id: c.id,
      name: c.name,
      contactName: c.contact_name,
      contactEmail: c.contact_email,
      accountManagerId: c.account_manager_id ?? null,
      accountManagerName: c.account_manager_id
        ? accountManagerNames.get(c.account_manager_id) ?? null
        : null,
      color: c.color || DEFAULT_CUSTOMER_COLOR,
      logoUrl: c.logo_url ?? null,
      initials: getInitials(c.name),
      isActive: c.is_active ?? true,
      activeProjectCount: activeProjects.length,
      primaryProject: primaryProject
        ? { name: primaryProject.name, isActive: primaryProject.is_active }
        : null,
      projects: customerProjects.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.is_active,
        type: p.type as ProjectType,
      })),
    };
  });
}
