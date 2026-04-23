import "server-only";
import { Pool, type PoolConfig } from "pg";
import { parse } from "pg-connection-string";
import { debugLog } from "@/lib/debugLogs";

/**
 * pg merges `parse(connectionString)` *after* top-level options, so
 * `sslmode=require` in the URL overwrites `ssl: { rejectUnauthorized: false }`
 * on `new Pool({ connectionString, ssl })` — causing "unable to verify the first certificate"
 * against Cloud SQL from local Node.
 *
 * Build config from parse(), drop parsed `ssl`, then set `ssl` explicitly.
 *
 * - Default: encrypted TLS but no CA verification (typical for dev / public IP Cloud SQL).
 * - Set `CLOUD_SQL_SSL_REJECT_UNAUTHORIZED=true` when you supply trust (e.g. sslrootcert in URL or proxy).
 */
function stripSslModeQuery(url: string): string {
  try {
    const u = new URL(
      url.replace(/^postgresql:/i, "postgres:")
    );
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return url;
  }
}

function getSslMode(url: string): string | null {
  try {
    const u = new URL(url.replace(/^postgresql:/i, "postgres:"));
    const mode = u.searchParams.get("sslmode");
    return mode ? mode.toLowerCase() : null;
  } catch {
    return null;
  }
}

function buildCloudSqlPoolConfig(): PoolConfig {
  const connectionString = process.env.CLOUD_SQL_URL;
  if (!connectionString) {
    throw new Error("CLOUD_SQL_URL is not set");
  }

  const sslMode = getSslMode(connectionString);
  const parsed = parse(stripSslModeQuery(connectionString));
  const { ssl: _parsedSsl, ...rest } = parsed;

  const portRaw = rest.port;
  const portNum =
    portRaw !== undefined && portRaw !== ""
      ? Number(portRaw)
      : undefined;

  const rejectUnauthorized =
    process.env.CLOUD_SQL_SSL_REJECT_UNAUTHORIZED === "true";
  const isUnixSocket = (rest.host ?? "").startsWith("/cloudsql/");
  const mustUseUnixSocket =
    process.env.NODE_ENV === "production" &&
    process.env.CLOUD_SQL_ENFORCE_UNIX_SOCKET !== "false";
  if (mustUseUnixSocket && !isUnixSocket) {
    throw new Error(
      "CLOUD_SQL_URL must use Cloud SQL unix socket host=/cloudsql/<project:region:instance> in production"
    );
  }
  const useSsl = sslMode !== "disable" && !isUnixSocket;

  const config: PoolConfig = {
    user: rest.user,
    password: rest.password,
    host: rest.host ?? undefined,
    database: rest.database ?? undefined,
    ...(portNum !== undefined && !Number.isNaN(portNum) ? { port: portNum } : {}),
    application_name: rest.application_name,
    ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
  };

  return config;
}

let poolSingleton: Pool | null = null;

function getCloudSqlPool(): Pool {
  if (poolSingleton) {
    return poolSingleton;
  }

  poolSingleton = new Pool(buildCloudSqlPoolConfig());
  poolSingleton.on("error", (error) => {
    debugLog(
      "db-pool",
      "pool error",
      { error: error.message, totalCount: poolSingleton?.totalCount ?? 0 },
      "error"
    );
  });
  debugLog("db-pool", "pool initialized", {
    totalCount: poolSingleton.totalCount,
    idleCount: poolSingleton.idleCount,
    waitingCount: poolSingleton.waitingCount,
  });
  return poolSingleton;
}

/**
 * Keep the existing import surface (`cloudSqlPool.query(...)`) but avoid
 * constructing the DB pool at module-load time, which can happen during build.
 */
export const cloudSqlPool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    return Reflect.get(getCloudSqlPool(), prop, receiver);
  },
});
