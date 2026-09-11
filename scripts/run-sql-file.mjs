import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";
import { parse } from "pg-connection-string";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node --env-file=.env.local scripts/run-sql-file.mjs <file.sql>");
  process.exit(1);
}

const connectionString = process.env.CLOUD_SQL_URL;
if (!connectionString) {
  console.error("CLOUD_SQL_URL is not set");
  process.exit(1);
}

const normalized = connectionString.replace(/^postgresql:/i, "postgres:");
const url = new URL(normalized);
const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
url.searchParams.delete("sslmode");
const parsed = parse(url.toString());
const { ssl: _parsedSsl, ...connection } = parsed;
void _parsedSsl;

const isUnixSocket = (connection.host ?? "").startsWith("/cloudsql/");
const useSsl = sslMode !== "disable" && !isUnixSocket;
const client = new pg.Client({
  ...connection,
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized:
            process.env.CLOUD_SQL_SSL_REJECT_UNAUTHORIZED === "true",
        },
      }
    : {}),
});

try {
  const sql = await readFile(file, "utf8");
  await client.connect();
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];
  for (const entry of results) {
    if (entry.command === "SELECT") {
      console.table(entry.rows);
    }
  }
  console.log(`Applied ${file}`);
} finally {
  await client.end().catch(() => {});
}
