import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type Team = {
  id: string;
  name: string;
};

export async function fetchTeams(): Promise<Team[]> {
  const { rows } = await cloudSqlPool.query<Team>(
    `SELECT id, name FROM teams ORDER BY name`
  );
  return rows;
}

export async function createTeamQuery(name: string): Promise<Team> {
  const { rows } = await cloudSqlPool.query<Team>(
    `INSERT INTO teams (name) VALUES ($1) RETURNING id, name`,
    [name.trim()]
  );
  if (!rows[0]) throw new Error("Failed to create team");
  return rows[0];
}

export async function updateTeamQuery(
  id: string,
  name: string
): Promise<Team> {
  const { rows } = await cloudSqlPool.query<Team>(
    `UPDATE teams SET name = $2, updated_at = now() WHERE id = $1 RETURNING id, name`,
    [id, name.trim()]
  );
  if (!rows[0]) throw new Error("Failed to update team");
  return rows[0];
}

export async function deleteTeamQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM teams WHERE id = $1`, [id]);
}
