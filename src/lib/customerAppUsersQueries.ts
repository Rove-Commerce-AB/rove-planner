import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type CustomerAppUser = {
  id: string;
  name: string;
  email: string;
};

export type CustomerAppUsersByCustomerId = Record<string, CustomerAppUser[]>;

export type PersonCustomerLink = {
  id: string;
  name: string;
  isInternal: boolean;
  url: string | null;
  color: string | null;
};

function mapPersonCustomerLink(row: {
  id: string;
  name: string;
  is_internal: boolean;
  url: string | null;
  color: string | null;
}): PersonCustomerLink {
  return {
    id: row.id,
    name: row.name,
    isInternal: row.is_internal,
    url: row.url,
    color: row.color,
  };
}

function displayName(name: string | null, email: string): string {
  return name?.trim() || email;
}

export async function getCustomerUsersByCustomerIds(
  customerIds: string[]
): Promise<CustomerAppUsersByCustomerId> {
  const uniqueCustomerIds = [...new Set(customerIds)].filter(Boolean);
  if (uniqueCustomerIds.length === 0) return {};

  const { rows } = await cloudSqlPool.query<{
    customer_id: string;
    id: string;
    name: string | null;
    email: string;
  }>(
    `SELECT cau.customer_id, u.id, u.name, u.email
     FROM customer_app_users cau
     JOIN app_users u ON u.id = cau.app_user_id
     WHERE cau.customer_id = ANY($1::uuid[])
     ORDER BY lower(COALESCE(NULLIF(trim(u.name), ''), u.email))`,
    [uniqueCustomerIds]
  );

  const result: CustomerAppUsersByCustomerId = Object.fromEntries(
    uniqueCustomerIds.map((customerId) => [customerId, []])
  );
  for (const row of rows) {
    result[row.customer_id]?.push({
      id: row.id,
      name: displayName(row.name, row.email),
      email: row.email,
    });
  }
  return result;
}

export async function getCustomerUsers(): Promise<CustomerAppUser[]> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string | null;
    email: string;
  }>(
    `SELECT id, name, email
     FROM app_users
     WHERE role = 'customer'
     ORDER BY lower(COALESCE(NULLIF(trim(name), ''), email))`
  );
  return rows.map((row) => ({
    id: row.id,
    name: displayName(row.name, row.email),
    email: row.email,
  }));
}

export async function getCustomersForAppUser(
  appUserId: string
): Promise<PersonCustomerLink[]> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    is_internal: boolean;
    url: string | null;
    color: string | null;
  }>(
    `SELECT c.id, c.name, c.is_internal, c.url, c.color
     FROM customer_app_users cau
     JOIN customers c ON c.id = cau.customer_id
     WHERE cau.app_user_id = $1
     ORDER BY c.name`,
    [appUserId]
  );
  return rows.map(mapPersonCustomerLink);
}

export async function getCustomersForConsultantIds(
  consultantIds: string[]
): Promise<Record<string, PersonCustomerLink[]>> {
  const unique = [...new Set(consultantIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const { rows } = await cloudSqlPool.query<{
    consultant_id: string;
    id: string;
    name: string;
    is_internal: boolean;
    url: string | null;
    color: string | null;
  }>(
    `SELECT cc.consultant_id, c.id, c.name, c.is_internal, c.url, c.color
     FROM customer_consultants cc
     JOIN customers c ON c.id = cc.customer_id
     WHERE cc.consultant_id = ANY($1::uuid[])
     ORDER BY c.name`,
    [unique]
  );

  const result: Record<string, PersonCustomerLink[]> = Object.fromEntries(
    unique.map((id) => [id, []])
  );
  for (const row of rows) {
    result[row.consultant_id]?.push(mapPersonCustomerLink(row));
  }
  return result;
}

export async function getCustomersForAppUserIds(
  appUserIds: string[]
): Promise<Record<string, PersonCustomerLink[]>> {
  const unique = [...new Set(appUserIds)].filter(Boolean);
  if (unique.length === 0) return {};

  const { rows } = await cloudSqlPool.query<{
    app_user_id: string;
    id: string;
    name: string;
    is_internal: boolean;
    url: string | null;
    color: string | null;
  }>(
    `SELECT cau.app_user_id, c.id, c.name, c.is_internal, c.url, c.color
     FROM customer_app_users cau
     JOIN customers c ON c.id = cau.customer_id
     WHERE cau.app_user_id = ANY($1::uuid[])
     ORDER BY c.name`,
    [unique]
  );

  const result: Record<string, PersonCustomerLink[]> = Object.fromEntries(
    unique.map((id) => [id, []])
  );
  for (const row of rows) {
    result[row.app_user_id]?.push(mapPersonCustomerLink(row));
  }
  return result;
}

export async function addCustomerUserToCustomer(
  customerId: string,
  appUserId: string
): Promise<void> {
  await cloudSqlPool.query(
    `INSERT INTO customer_app_users (customer_id, app_user_id)
     VALUES ($1, $2)
     ON CONFLICT (customer_id, app_user_id) DO NOTHING`,
    [customerId, appUserId]
  );
}

export async function removeCustomerUserFromCustomer(
  customerId: string,
  appUserId: string
): Promise<void> {
  await cloudSqlPool.query(
    `DELETE FROM customer_app_users
     WHERE customer_id = $1 AND app_user_id = $2`,
    [customerId, appUserId]
  );
}
