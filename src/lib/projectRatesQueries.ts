import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { parseBillingCurrency } from "./currency";
import {
  encodeBillingItemKey,
  normalizeCustomTaskName,
} from "./billingItem";

export type ProjectRate = {
  id: string;
  project_id: string;
  role_id: string | null;
  name: string | null;
  active: boolean;
  display_name: string;
  rate_per_hour: number;
  currency: string;
};

function mapRow(r: {
  id: string;
  project_id: string;
  role_id: string | null;
  name: string | null;
  active: boolean;
  display_name?: string | null;
  role_name?: string | null;
  rate_per_hour: string | number;
  currency: string | null;
}): ProjectRate {
  const display_name =
    (r.display_name ?? r.name ?? r.role_name ?? "").trim() || "Unknown";
  return {
    id: r.id,
    project_id: r.project_id,
    role_id: r.role_id ?? null,
    name: r.name ?? null,
    active: r.active !== false,
    display_name,
    rate_per_hour: Number(r.rate_per_hour),
    currency: parseBillingCurrency(r.currency),
  };
}

const PROJECT_RATE_SELECT = `
  pr.id,
  pr.project_id,
  pr.role_id,
  pr.name,
  pr.active,
  pr.rate_per_hour,
  pr.currency,
  r.name AS role_name,
  COALESCE(pr.name, r.name) AS display_name
`;

export async function fetchProjectRates(
  projectId: string,
  opts?: { includeInactive?: boolean }
): Promise<ProjectRate[]> {
  const includeInactive = opts?.includeInactive === true;
  const { rows } = await cloudSqlPool.query(
    `SELECT ${PROJECT_RATE_SELECT}
     FROM project_rates pr
     LEFT JOIN roles r ON r.id = pr.role_id
     WHERE pr.project_id = $1
       AND ($2::boolean OR pr.active = true)
     ORDER BY COALESCE(pr.name, r.name)`,
    [projectId, includeInactive]
  );
  return rows.map(mapRow);
}

export async function fetchProjectRatesByProjectIds(
  projectIds: string[],
  opts?: { includeInactive?: boolean }
): Promise<ProjectRate[]> {
  if (projectIds.length === 0) return [];
  const includeInactive = opts?.includeInactive === true;

  const { rows } = await cloudSqlPool.query(
    `SELECT ${PROJECT_RATE_SELECT}
     FROM project_rates pr
     LEFT JOIN roles r ON r.id = pr.role_id
     WHERE pr.project_id = ANY($1::uuid[])
       AND ($2::boolean OR pr.active = true)`,
    [projectIds, includeInactive]
  );
  return rows.map(mapRow);
}

async function fetchProjectRatesByIds(ids: string[]): Promise<ProjectRate[]> {
  if (ids.length === 0) return [];
  const { rows } = await cloudSqlPool.query(
    `SELECT ${PROJECT_RATE_SELECT}
     FROM project_rates pr
     LEFT JOIN roles r ON r.id = pr.role_id
     WHERE pr.id = ANY($1::uuid[])`,
    [ids]
  );
  return rows.map(mapRow);
}

export async function assertProjectCustomTaskNameAvailable(
  projectId: string,
  name: string,
  excludeRateId?: string
): Promise<void> {
  const normalized = normalizeCustomTaskName(name);
  if (!normalized) {
    throw new Error("Enter a task name");
  }
  const { rows: projectRows } = await cloudSqlPool.query<{ customer_id: string }>(
    `SELECT customer_id FROM projects WHERE id = $1`,
    [projectId]
  );
  const customerId = projectRows[0]?.customer_id;
  if (!customerId) throw new Error("Project not found");

  const { rows } = await cloudSqlPool.query<{ kind: string }>(
    `SELECT 'project' AS kind
     FROM project_rates
     WHERE project_id = $1
       AND role_id IS NULL
       AND lower(btrim(name)) = lower($2)
       AND ($3::uuid IS NULL OR id <> $3::uuid)
     UNION ALL
     SELECT 'customer' AS kind
     FROM customer_rates
     WHERE customer_id = $4
       AND role_id IS NULL
       AND lower(btrim(name)) = lower($2)
     UNION ALL
     SELECT 'role' AS kind
     FROM project_rates pr
     JOIN roles r ON r.id = pr.role_id
     WHERE pr.project_id = $1
       AND lower(btrim(r.name)) = lower($2)
     UNION ALL
     SELECT 'customer_role' AS kind
     FROM customer_rates cr
     JOIN roles r ON r.id = cr.role_id
     WHERE cr.customer_id = $4
       AND lower(btrim(r.name)) = lower($2)
     LIMIT 1`,
    [projectId, normalized, excludeRateId ?? null, customerId]
  );
  if (rows[0]) {
    throw new Error(`A task named "${normalized}" already exists for this customer`);
  }
}

export async function createProjectRateQuery(
  projectId: string,
  input: {
    roleId?: string | null;
    name?: string | null;
    ratePerHour: number;
    currency?: string;
  }
): Promise<ProjectRate> {
  const billingCurrency = parseBillingCurrency(input.currency);
  const roleId = input.roleId?.trim() || null;
  const customName = roleId ? null : normalizeCustomTaskName(input.name ?? "");
  if (!roleId && !customName) {
    throw new Error("Select a role or enter a task name");
  }
  if (customName) {
    await assertProjectCustomTaskNameAvailable(projectId, customName);
  }
  const { rows } = await cloudSqlPool.query(
    `INSERT INTO project_rates (project_id, role_id, name, rate_per_hour, currency)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, role_id, name, active, rate_per_hour, currency`,
    [projectId, roleId, customName, input.ratePerHour, billingCurrency]
  );
  if (!rows[0]) throw new Error("Failed to create project rate");
  const created = rows[0] as Parameters<typeof mapRow>[0];
  const [hydrated] = await fetchProjectRatesByIds([created.id]);
  return hydrated ?? mapRow(created);
}

export async function updateProjectRateQuery(
  id: string,
  ratePerHour: number
): Promise<ProjectRate> {
  const { rows } = await cloudSqlPool.query(
    `UPDATE project_rates SET rate_per_hour = $2, updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [id, ratePerHour]
  );
  if (!rows[0]) throw new Error("Failed to update project rate");
  const [hydrated] = await fetchProjectRatesByIds([id]);
  if (!hydrated) throw new Error("Failed to update project rate");
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

export async function deleteProjectRateQuery(id: string): Promise<void> {
  try {
    await cloudSqlPool.query(`DELETE FROM project_rates WHERE id = $1`, [id]);
  } catch (error) {
    if (!isFkViolation(error)) throw error;
    await cloudSqlPool.query(
      `UPDATE project_rates SET active = false, updated_at = now() WHERE id = $1`,
      [id]
    );
  }
}

export async function fetchBillingItemsForCustomerAndProject(
  customerId: string,
  projectId?: string | null
): Promise<{ id: string; name: string }[]> {
  const [customerRates, projectRates] = await Promise.all([
    cloudSqlPool.query<{
      id: string;
      role_id: string | null;
      display_name: string;
    }>(
      `SELECT cr.id, cr.role_id, COALESCE(cr.name, r.name) AS display_name
       FROM customer_rates cr
       LEFT JOIN roles r ON r.id = cr.role_id
       WHERE cr.customer_id = $1 AND cr.active = true`,
      [customerId]
    ),
    projectId
      ? cloudSqlPool.query<{
          id: string;
          role_id: string | null;
          display_name: string;
        }>(
          `SELECT pr.id, pr.role_id, COALESCE(pr.name, r.name) AS display_name
           FROM project_rates pr
           LEFT JOIN roles r ON r.id = pr.role_id
           WHERE pr.project_id = $1 AND pr.active = true`,
          [projectId]
        )
      : Promise.resolve({ rows: [] as { id: string; role_id: string | null; display_name: string }[] }),
  ]);

  const byRole = new Map<string, { id: string; name: string }>();
  const customs: { id: string; name: string }[] = [];

  for (const row of customerRates.rows) {
    const name = (row.display_name ?? "").trim() || "Unknown";
    if (row.role_id) {
      byRole.set(row.role_id, { id: row.role_id, name });
    } else {
      customs.push({
        id: encodeBillingItemKey({ kind: "customer_rate", id: row.id }),
        name,
      });
    }
  }
  for (const row of projectRates.rows) {
    const name = (row.display_name ?? "").trim() || "Unknown";
    if (row.role_id) {
      byRole.set(row.role_id, { id: row.role_id, name });
    } else {
      customs.push({
        id: encodeBillingItemKey({ kind: "project_rate", id: row.id }),
        name,
      });
    }
  }

  return [...byRole.values(), ...customs].sort((a, b) =>
    a.name.localeCompare(b.name, "sv", { sensitivity: "base" })
  );
}

export async function fetchRolesWithRateForAllocation(
  projectId: string,
  customerId: string
): Promise<{ id: string; name: string }[]> {
  return fetchBillingItemsForCustomerAndProject(customerId, projectId);
}
