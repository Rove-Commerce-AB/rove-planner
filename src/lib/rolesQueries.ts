import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type Role = {
  id: string;
  name: string;
};

export async function fetchRoles(): Promise<Role[]> {
  const { rows } = await cloudSqlPool.query<Role>(
    `SELECT id, name FROM roles ORDER BY name`
  );
  return rows;
}

export async function createRoleQuery(name: string): Promise<Role> {
  const { rows } = await cloudSqlPool.query<Role>(
    `INSERT INTO roles (name) VALUES ($1) RETURNING id, name`,
    [name.trim()]
  );
  if (!rows[0]) throw new Error("Failed to create role");
  return rows[0];
}

export async function updateRoleQuery(
  id: string,
  name: string
): Promise<Role> {
  const { rows } = await cloudSqlPool.query<Role>(
    `UPDATE roles SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, name`,
    [id, name.trim()]
  );
  if (!rows[0]) throw new Error("Failed to update role");
  return rows[0];
}

export async function deleteRoleQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM roles WHERE id = $1`, [id]);
}
