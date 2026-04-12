import { cloudSqlPool } from "@/lib/cloudSqlPool";

import { DEFAULT_CUSTOMER_COLOR } from "./constants";
import { fetchProjectsByCustomerIds } from "./projectsLookupQueries";
import type { CustomerWithDetails, ProjectType } from "@/types";

export type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  account_manager_id: string | null;
  color: string | null;
  logo_url: string | null;
  url: string | null;
  is_active: boolean;
};

export type CreateCustomerInput = {
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  account_manager_id?: string | null;
  color?: string | null;
  logo_url?: string | null;
  url?: string | null;
  is_active?: boolean;
};

export type UpdateCustomerInput = {
  name?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  account_manager_id?: string | null;
  color?: string | null;
  logo_url?: string | null;
  url?: string | null;
  is_active?: boolean;
};

const CUSTOMER_SELECT =
  "id, name, contact_name, contact_email, account_manager_id, color, logo_url, url, is_active";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

async function consultantNamesMap(
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
    `SELECT id, name FROM consultants WHERE id = ANY($1::uuid[])`,
    [unique]
  );
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.id, row.name ?? "");
  }
  return map;
}

export async function fetchCustomerById(
  id: string
): Promise<CustomerWithDetails | null> {
  const { rows } = await cloudSqlPool.query(
    `SELECT ${CUSTOMER_SELECT} FROM customers WHERE id = $1`,
    [id]
  );
  const data = rows[0] as Customer | undefined;
  if (!data) return null;

  const accountManagerNames = data.account_manager_id
    ? await consultantNamesMap([data.account_manager_id])
    : new Map<string, string>();

  let projectsByCustomer = new Map<
    string,
    { id: string; name: string; is_active: boolean; type: string }[]
  >();
  try {
    const projects = await fetchProjectsByCustomerIds([data.id]);
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
    url: data.url ?? null,
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

export async function fetchCustomers(): Promise<Customer[]> {
  const { rows } = await cloudSqlPool.query<Customer>(
    `SELECT ${CUSTOMER_SELECT} FROM customers ORDER BY name`
  );
  return rows;
}

export async function fetchCustomerIdByName(
  name: string
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `SELECT id FROM customers WHERE lower(name) = lower($1) LIMIT 1`,
    [trimmed]
  );
  return rows[0]?.id ?? null;
}

export async function fetchCustomersByIds(ids: string[]): Promise<Customer[]> {
  if (ids.length === 0) return [];
  const { rows } = await cloudSqlPool.query<Customer>(
    `SELECT ${CUSTOMER_SELECT} FROM customers WHERE id = ANY($1::uuid[]) ORDER BY name`,
    [ids]
  );
  return rows;
}

export async function createCustomerQuery(
  input: CreateCustomerInput
): Promise<Customer> {
  const { rows } = await cloudSqlPool.query<Customer>(
    `INSERT INTO customers (
       name, contact_name, contact_email, account_manager_id, color, logo_url, url, is_active
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${CUSTOMER_SELECT}`,
    [
      input.name.trim(),
      input.contact_name?.trim() || null,
      input.contact_email?.trim() || null,
      input.account_manager_id ?? null,
      input.color?.trim() || DEFAULT_CUSTOMER_COLOR,
      input.logo_url?.trim() || null,
      input.url?.trim() ?? null,
      input.is_active ?? true,
    ]
  );
  if (!rows[0]) throw new Error("Failed to create customer");
  return rows[0];
}

export async function updateCustomerQuery(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(input.name.trim());
  }
  if (input.contact_name !== undefined) {
    sets.push(`contact_name = $${i++}`);
    values.push(input.contact_name?.trim() || null);
  }
  if (input.contact_email !== undefined) {
    sets.push(`contact_email = $${i++}`);
    values.push(input.contact_email?.trim() || null);
  }
  if (input.account_manager_id !== undefined) {
    sets.push(`account_manager_id = $${i++}`);
    values.push(input.account_manager_id ?? null);
  }
  if (input.color !== undefined) {
    sets.push(`color = $${i++}`);
    values.push(input.color?.trim() || DEFAULT_CUSTOMER_COLOR);
  }
  if (input.logo_url !== undefined) {
    sets.push(`logo_url = $${i++}`);
    values.push(input.logo_url?.trim() || null);
  }
  if (input.url !== undefined) {
    sets.push(`url = $${i++}`);
    values.push(input.url?.trim() || null);
  }
  if (input.is_active !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(input.is_active);
  }
  sets.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await cloudSqlPool.query<Customer>(
    `UPDATE customers SET ${sets.join(", ")} WHERE id = $${i} RETURNING ${CUSTOMER_SELECT}`,
    values
  );
  if (!rows[0]) throw new Error("Failed to update customer");
  return rows[0];
}

export async function deleteCustomerQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM customers WHERE id = $1`, [id]);
}

export async function fetchCustomersWithDetails(): Promise<
  CustomerWithDetails[]
> {
  const customers = await fetchCustomers();

  const accountManagerIds = [
    ...new Set(customers.map((c) => c.account_manager_id).filter(Boolean)),
  ] as string[];
  const accountManagerNames = await consultantNamesMap(accountManagerIds);

  let projectsByCustomer = new Map<
    string,
    { id: string; name: string; is_active: boolean; type: string }[]
  >();
  try {
    const projects = await fetchProjectsByCustomerIds(
      customers.map((c) => c.id)
    );
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
      url: c.url ?? null,
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
