import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type ProjectRate = {
  id: string;
  project_id: string;
  role_id: string;
  rate_per_hour: number;
  currency: string;
};

function mapRow(r: {
  id: string;
  project_id: string;
  role_id: string;
  rate_per_hour: string | number;
  currency: string | null;
}): ProjectRate {
  return {
    id: r.id,
    project_id: r.project_id,
    role_id: r.role_id,
    rate_per_hour: Number(r.rate_per_hour),
    currency: r.currency ?? "SEK",
  };
}

export async function fetchProjectRates(
  projectId: string
): Promise<ProjectRate[]> {
  const { rows } = await cloudSqlPool.query(
    `SELECT id, project_id, role_id, rate_per_hour, currency
     FROM project_rates WHERE project_id = $1`,
    [projectId]
  );
  return rows.map(mapRow);
}

export async function createProjectRateQuery(
  projectId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
): Promise<ProjectRate> {
  const { rows } = await cloudSqlPool.query(
    `INSERT INTO project_rates (project_id, role_id, rate_per_hour, currency)
     VALUES ($1, $2, $3, $4)
     RETURNING id, project_id, role_id, rate_per_hour, currency`,
    [projectId, roleId, ratePerHour, currency]
  );
  if (!rows[0]) throw new Error("Failed to create project rate");
  return mapRow(rows[0] as Parameters<typeof mapRow>[0]);
}

export async function updateProjectRateQuery(
  id: string,
  ratePerHour: number
): Promise<ProjectRate> {
  const { rows } = await cloudSqlPool.query(
    `UPDATE project_rates SET rate_per_hour = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, project_id, role_id, rate_per_hour, currency`,
    [id, ratePerHour]
  );
  if (!rows[0]) throw new Error("Failed to update project rate");
  return mapRow(rows[0] as Parameters<typeof mapRow>[0]);
}

export async function deleteProjectRateQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM project_rates WHERE id = $1`, [id]);
}

async function getRoleIdsWithRateForAllocation(
  projectId: string,
  customerId: string
): Promise<string[]> {
  const [pr, cr] = await Promise.all([
    cloudSqlPool.query<{ role_id: string }>(
      `SELECT role_id FROM project_rates WHERE project_id = $1`,
      [projectId]
    ),
    cloudSqlPool.query<{ role_id: string }>(
      `SELECT role_id FROM customer_rates WHERE customer_id = $1`,
      [customerId]
    ),
  ]);
  const projectRates = pr.rows.map((r) => r.role_id);
  const customerRates = cr.rows.map((r) => r.role_id);
  return [...new Set([...projectRates, ...customerRates])];
}

export async function fetchRolesWithRateForAllocation(
  projectId: string,
  customerId: string
): Promise<{ id: string; name: string }[]> {
  const roleIds = await getRoleIdsWithRateForAllocation(projectId, customerId);
  if (roleIds.length === 0) return [];

  const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
    `SELECT id, name FROM roles WHERE id = ANY($1::uuid[]) ORDER BY name`,
    [roleIds]
  );
  return rows.map((r) => ({ id: r.id, name: r.name }));
}
