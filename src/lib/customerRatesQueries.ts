import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { parseBillingCurrency } from "./currency";
import { normalizeCustomTaskName } from "./billingItem";

export type CustomerRate = {
  id: string;
  customer_id: string;
  role_id: string | null;
  name: string | null;
  active: boolean;
  display_name: string;
  rate_per_hour: number;
  currency: string;
};

function mapRow(r: {
  id: string;
  customer_id: string;
  role_id: string | null;
  name: string | null;
  active: boolean;
  display_name?: string | null;
  role_name?: string | null;
  rate_per_hour: string | number;
  currency: string | null;
}): CustomerRate {
  const display_name =
    (r.display_name ?? r.name ?? r.role_name ?? "").trim() || "Unknown";
  return {
    id: r.id,
    customer_id: r.customer_id,
    role_id: r.role_id ?? null,
    name: r.name ?? null,
    active: r.active !== false,
    display_name,
    rate_per_hour: Number(r.rate_per_hour),
    currency: parseBillingCurrency(r.currency),
  };
}

const CUSTOMER_RATE_SELECT = `
  cr.id,
  cr.customer_id,
  cr.role_id,
  cr.name,
  cr.active,
  cr.rate_per_hour,
  cr.currency,
  r.name AS role_name,
  COALESCE(cr.name, r.name) AS display_name
`;

export async function fetchCustomerRates(
  customerId: string,
  opts?: { includeInactive?: boolean }
): Promise<CustomerRate[]> {
  const includeInactive = opts?.includeInactive === true;
  const { rows } = await cloudSqlPool.query(
    `SELECT ${CUSTOMER_RATE_SELECT}
     FROM customer_rates cr
     LEFT JOIN roles r ON r.id = cr.role_id
     WHERE cr.customer_id = $1
       AND ($2::boolean OR cr.active = true)
     ORDER BY COALESCE(cr.name, r.name)`,
    [customerId, includeInactive]
  );
  return rows.map(mapRow);
}

export async function fetchCustomerRatesByCustomerIds(
  customerIds: string[],
  opts?: { includeInactive?: boolean }
): Promise<CustomerRate[]> {
  if (customerIds.length === 0) return [];
  const includeInactive = opts?.includeInactive === true;

  const { rows } = await cloudSqlPool.query(
    `SELECT ${CUSTOMER_RATE_SELECT}
     FROM customer_rates cr
     LEFT JOIN roles r ON r.id = cr.role_id
     WHERE cr.customer_id = ANY($1::uuid[])
       AND ($2::boolean OR cr.active = true)`,
    [customerIds, includeInactive]
  );
  return rows.map(mapRow);
}

export async function assertCustomerCustomTaskNameAvailable(
  customerId: string,
  name: string,
  excludeRateId?: string
): Promise<void> {
  const normalized = normalizeCustomTaskName(name);
  if (!normalized) {
    throw new Error("Enter a task name");
  }
  const { rows } = await cloudSqlPool.query<{ kind: string }>(
    `SELECT 'customer' AS kind
     FROM customer_rates
     WHERE customer_id = $1
       AND role_id IS NULL
       AND lower(btrim(name)) = lower($2)
       AND ($3::uuid IS NULL OR id <> $3::uuid)
     UNION ALL
     SELECT 'project' AS kind
     FROM project_rates pr
     JOIN projects p ON p.id = pr.project_id
     WHERE p.customer_id = $1
       AND pr.role_id IS NULL
       AND lower(btrim(pr.name)) = lower($2)
     UNION ALL
     SELECT 'role' AS kind
     FROM customer_rates cr
     JOIN roles r ON r.id = cr.role_id
     WHERE cr.customer_id = $1
       AND lower(btrim(r.name)) = lower($2)
     LIMIT 1`,
    [customerId, normalized, excludeRateId ?? null]
  );
  if (rows[0]) {
    throw new Error(`A task named "${normalized}" already exists for this customer`);
  }
}

export async function createCustomerRateQuery(
  customerId: string,
  input: {
    roleId?: string | null;
    name?: string | null;
    ratePerHour: number;
    currency?: string;
  }
): Promise<CustomerRate> {
  const billingCurrency = parseBillingCurrency(input.currency);
  const roleId = input.roleId?.trim() || null;
  const customName = roleId ? null : normalizeCustomTaskName(input.name ?? "");
  if (!roleId && !customName) {
    throw new Error("Select a role or enter a task name");
  }
  if (customName) {
    await assertCustomerCustomTaskNameAvailable(customerId, customName);
  }
  const { rows } = await cloudSqlPool.query(
    `INSERT INTO customer_rates (customer_id, role_id, name, rate_per_hour, currency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, customer_id, role_id, name, active, rate_per_hour, currency`,
    [customerId, roleId, customName, input.ratePerHour, billingCurrency]
  );
  if (!rows[0]) throw new Error("Failed to create customer rate");
  const created = rows[0] as Parameters<typeof mapRow>[0];
  const [hydrated] = await fetchCustomerRatesByIds([created.id]);
  return hydrated ?? mapRow(created);
}

async function fetchCustomerRatesByIds(ids: string[]): Promise<CustomerRate[]> {
  if (ids.length === 0) return [];
  const { rows } = await cloudSqlPool.query(
    `SELECT ${CUSTOMER_RATE_SELECT}
     FROM customer_rates cr
     LEFT JOIN roles r ON r.id = cr.role_id
     WHERE cr.id = ANY($1::uuid[])`,
    [ids]
  );
  return rows.map(mapRow);
}

export async function updateCustomerRateQuery(
  id: string,
  ratePerHour: number
): Promise<CustomerRate> {
  const { rows } = await cloudSqlPool.query(
    `UPDATE customer_rates SET rate_per_hour = $2, updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, ratePerHour]
  );
  if (!rows[0]) throw new Error("Failed to update customer rate");
  const [hydrated] = await fetchCustomerRatesByIds([id]);
  if (!hydrated) throw new Error("Failed to update customer rate");
  return hydrated;
}

function isFkViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code: string }).code === "23503"
  );
}

export async function deleteCustomerRateQuery(id: string): Promise<void> {
  try {
    await cloudSqlPool.query(`DELETE FROM customer_rates WHERE id = $1`, [id]);
  } catch (error) {
    if (!isFkViolation(error)) throw error;
    await cloudSqlPool.query(
      `UPDATE customer_rates SET active = false, updated_at = now() WHERE id = $1`,
      [id]
    );
  }
}
