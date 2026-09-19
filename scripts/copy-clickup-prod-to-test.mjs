import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function urlFromEnv(fileName) {
  const text = fs.readFileSync(path.join(root, fileName), "utf8");
  const line = text
    .split(/\r?\n/)
    .find((l) => l.startsWith("CLOUD_SQL_URL=") && !l.trimStart().startsWith("#"));
  if (!line) throw new Error(`No CLOUD_SQL_URL in ${fileName}`);
  const raw = line.slice("CLOUD_SQL_URL=".length).trim();
  // Force Node pg TLS that accepts Cloud SQL public certs.
  const u = new URL(raw);
  u.searchParams.delete("sslmode");
  return u.toString();
}

function poolFromEnv(fileName) {
  return new pg.Pool({
    connectionString: urlFromEnv(fileName),
    ssl: { rejectUnauthorized: false },
  });
}

const cols = [
  "clickup_id",
  "summary",
  "parent_key",
  "parent_summary",
  "parent_type",
  "status",
  "created_at",
  "updated_at",
  "due_date",
  "issue_type",
  "original_estimate_hours",
  "source_instance",
  "last_synced_at",
  "project_key",
  "project_name",
  "space_id",
  "space_name",
  "folder_id",
  "folder_name",
  "url",
];

const prod = poolFromEnv(".env.prod.local");
const test = poolFromEnv(".env.local");

const spaceFolderSql = fs.readFileSync(
  path.join(root, "scripts/20260919_clickup_space_folder.sql"),
  "utf8"
);
const fnSql = fs.readFileSync(
  path.join(root, "scripts/20260919_clickup_distinct_by_folder.sql"),
  "utf8"
);

try {
  console.log("Ensuring test schema...");
  // Base table first (no-op if it already exists without newer columns).
  await test.query(`
    CREATE TABLE IF NOT EXISTS clickup (
      clickup_id TEXT PRIMARY KEY,
      summary TEXT NULL,
      parent_key TEXT NULL,
      parent_summary TEXT NULL,
      parent_type TEXT NULL,
      status TEXT NULL,
      created_at TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NULL,
      due_date TIMESTAMPTZ NULL,
      issue_type TEXT NULL,
      original_estimate_hours NUMERIC NULL,
      source_instance TEXT NULL,
      last_synced_at TIMESTAMPTZ NULL DEFAULT now(),
      project_key TEXT NULL,
      project_name TEXT NULL,
      url TEXT NULL
    )
  `);
  await test.query(spaceFolderSql);
  await test.query(`
    CREATE INDEX IF NOT EXISTS clickup_project_key_idx ON clickup (project_key)
  `);
  await test.query(fnSql);
  // Ensure projects.clickup_project_id exists for the folder-based picker.
  await test.query(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS clickup_project_id TEXT
  `);
  await test.query(`
    CREATE INDEX IF NOT EXISTS projects_clickup_project_id_idx
      ON projects (clickup_project_id)
      WHERE clickup_project_id IS NOT NULL
  `);

  const testCols = await test.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clickup'
    ORDER BY ordinal_position
  `);
  console.log(
    "Test columns:",
    testCols.rows.map((r) => r.column_name).join(", ")
  );

  const {
    rows: [{ n }],
  } = await prod.query("SELECT COUNT(*)::int AS n FROM clickup");
  console.log("Prod rows:", n);

  console.log("Truncating test.clickup and copying...");
  await test.query("TRUNCATE TABLE clickup");

  const batchSize = 500;
  let offset = 0;
  let copied = 0;
  const colList = cols.join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");

  while (offset < n) {
    const { rows } = await prod.query(
      `SELECT ${colList} FROM clickup ORDER BY clickup_id LIMIT $1 OFFSET $2`,
      [batchSize, offset]
    );
    if (!rows.length) break;

    const client = await test.connect();
    try {
      await client.query("BEGIN");
      for (const row of rows) {
        await client.query(
          `INSERT INTO clickup (${colList}) VALUES (${placeholders})`,
          cols.map((c) => row[c])
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    copied += rows.length;
    offset += rows.length;
    console.log(`Copied ${copied}/${n}`);
  }

  const verify = await test.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(space_name)::int AS with_space,
      COUNT(folder_name)::int AS with_folder
    FROM clickup
  `);
  const folders = await test.query(
    "SELECT * FROM get_distinct_clickup_projects()"
  );
  console.log("Test verify:", verify.rows[0]);
  console.log("Folders:", folders.rows);
} finally {
  await prod.end();
  await test.end();
}
