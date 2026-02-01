import { supabase } from "./supabaseClient";
import { getProjectsByCustomerIds } from "./projects";
import { DEFAULT_CUSTOMER_COLOR } from "./constants";
import type { CustomerWithDetails } from "@/types";

export type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  color: string | null;
  logo_url: string | null;
};

export type CreateCustomerInput = {
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  color?: string | null;
  logo_url?: string | null;
};

export type UpdateCustomerInput = {
  name?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  color?: string | null;
  logo_url?: string | null;
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
    .select("id,name,contact_name,contact_email,color,logo_url")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  let projectsByCustomer = new Map<string, { name: string; is_active: boolean }[]>();
  try {
    const projects = await getProjectsByCustomerIds([data.id]);
    for (const p of projects) {
      const list = projectsByCustomer.get(p.customer_id) ?? [];
      list.push({ name: p.name, is_active: p.is_active });
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
    color: data.color || DEFAULT_CUSTOMER_COLOR,
    logoUrl: data.logo_url ?? null,
    initials: getInitials(data.name),
    activeProjectCount: activeProjects.length,
    primaryProject: primaryProject
      ? { name: primaryProject.name, isActive: primaryProject.is_active }
      : null,
  };
}

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,contact_name,contact_email,color,logo_url")
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
      color: input.color?.trim() || DEFAULT_CUSTOMER_COLOR,
      logo_url: input.logo_url?.trim() || null,
    })
    .select("id,name,contact_name,contact_email,color,logo_url")
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
      ...(input.color !== undefined && {
        color: input.color?.trim() || DEFAULT_CUSTOMER_COLOR,
      }),
      ...(input.logo_url !== undefined && {
        logo_url: input.logo_url?.trim() || null,
      }),
    })
    .eq("id", id)
    .select("id,name,contact_name,contact_email,color,logo_url")
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

  let projectsByCustomer = new Map<
    string,
    { name: string; is_active: boolean }[]
  >();
  try {
    const projects = await getProjectsByCustomerIds(customers.map((c) => c.id));
    for (const p of projects) {
      const list = projectsByCustomer.get(p.customer_id) ?? [];
      list.push({ name: p.name, is_active: p.is_active });
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
      color: c.color || DEFAULT_CUSTOMER_COLOR,
      logoUrl: c.logo_url ?? null,
      initials: getInitials(c.name),
      activeProjectCount: activeProjects.length,
      primaryProject: primaryProject
        ? { name: primaryProject.name, isActive: primaryProject.is_active }
        : null,
    };
  });
}
