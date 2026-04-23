import "server-only";
import { Pool, type PoolConfig } from "pg";
import { parse } from "pg-connection-string";

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

function buildCloudSqlPoolConfig(): PoolConfig {
  const connectionString = process.env.CLOUD_SQL_URL;
  if (!connectionString) {
    throw new Error("CLOUD_SQL_URL is not set");
  }

  const parsed = parse(stripSslModeQuery(connectionString));
  const { ssl: _parsedSsl, ...rest } = parsed;

  const portRaw = rest.port;
  const portNum =
    portRaw !== undefined && portRaw !== ""
      ? Number(portRaw)
      : undefined;

  const rejectUnauthorized =
    process.env.CLOUD_SQL_SSL_REJECT_UNAUTHORIZED === "true";

  const config: PoolConfig = {
    user: rest.user,
    password: rest.password,
    host: rest.host ?? undefined,
    database: rest.database ?? undefined,
    ...(portNum !== undefined && !Number.isNaN(portNum) ? { port: portNum } : {}),
    application_name: rest.application_name,
    ssl: { rejectUnauthorized },
  };

  return config;
}

let poolSingleton: Pool | null = null;

function getCloudSqlPool(): Pool {
  if (poolSingleton) {
    return poolSingleton;
  }

  poolSingleton = new Pool(buildCloudSqlPoolConfig());
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
