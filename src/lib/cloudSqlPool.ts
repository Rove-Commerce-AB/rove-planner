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

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return undefined;
  return Math.floor(n);
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
  const isProd = process.env.NODE_ENV === "production";
  const max = parsePositiveInt(process.env.CLOUD_SQL_POOL_MAX) ?? (isProd ? 5 : undefined);
  const idleTimeoutMillis =
    parsePositiveInt(process.env.CLOUD_SQL_IDLE_TIMEOUT_MS) ??
    (isProd ? 20_000 : undefined);
  const connectionTimeoutMillis =
    parsePositiveInt(process.env.CLOUD_SQL_CONNECTION_TIMEOUT_MS) ??
    (isProd ? 5_000 : undefined);
  const keepAliveEnabled =
    process.env.CLOUD_SQL_KEEP_ALIVE === "false" ? false : true;
  const keepAliveInitialDelayMillis =
    parsePositiveInt(process.env.CLOUD_SQL_KEEP_ALIVE_INITIAL_DELAY_MS) ??
    10_000;

  const config: PoolConfig = {
    user: rest.user,
    password: rest.password,
    host: rest.host ?? undefined,
    database: rest.database ?? undefined,
    ...(portNum !== undefined && !Number.isNaN(portNum) ? { port: portNum } : {}),
    application_name: rest.application_name,
    ...(useSsl ? { ssl: { rejectUnauthorized } } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(idleTimeoutMillis !== undefined ? { idleTimeoutMillis } : {}),
    ...(connectionTimeoutMillis !== undefined ? { connectionTimeoutMillis } : {}),
    keepAlive: keepAliveEnabled,
    keepAliveInitialDelayMillis,
  };

  return config;
}

let poolSingleton: Pool | null = null;

function getCloudSqlPool(): Pool {
  if (poolSingleton) {
    return poolSingleton;
  }

  poolSingleton = new Pool(buildCloudSqlPoolConfig());
  instrumentPool(poolSingleton);
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

export type CloudSqlPoolStats = {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
};

function readPoolStats(pool: Pool): CloudSqlPoolStats {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

function instrumentPool(pool: Pool) {
  const marker = pool as Pool & { __instrumented?: boolean };
  if (marker.__instrumented) return;
  marker.__instrumented = true;

  const anyPool = pool as any;
  const rawQuery = anyPool.query.bind(pool) as (...args: any[]) => Promise<any>;
  const rawConnect = anyPool.connect.bind(pool) as (...args: any[]) => Promise<any>;

  anyPool.query = async (...args: any[]) => {
    const before = readPoolStats(pool);
    const start = Date.now();
    try {
      const result = await rawQuery(...args);
      const durationMs = Date.now() - start;
      const after = readPoolStats(pool);
      if (before.waitingCount > 0 || after.waitingCount > 0 || durationMs >= 1000) {
        debugLog("db-pool", "query snapshot", {
          durationMs,
          poolBefore: before,
          poolAfter: after,
        });
      }
      return result;
    } catch (error) {
      debugLog(
        "db-pool",
        "query failed",
        {
          durationMs: Date.now() - start,
          poolBefore: before,
          poolAfter: readPoolStats(pool),
          error: error instanceof Error ? error.message : String(error),
        },
        "error"
      );
      throw error;
    }
  };

  anyPool.connect = async (...args: any[]) => {
    const before = readPoolStats(pool);
    const start = Date.now();
    try {
      const client = await rawConnect(...args);
      const durationMs = Date.now() - start;
      const after = readPoolStats(pool);
      if (before.waitingCount > 0 || after.waitingCount > 0 || durationMs >= 500) {
        debugLog("db-pool", "connect snapshot", {
          durationMs,
          poolBefore: before,
          poolAfter: after,
        });
      }
      return client;
    } catch (error) {
      debugLog(
        "db-pool",
        "connect failed",
        {
          durationMs: Date.now() - start,
          poolBefore: before,
          poolAfter: readPoolStats(pool),
          error: error instanceof Error ? error.message : String(error),
        },
        "error"
      );
      throw error;
    }
  };
}

export function getCloudSqlPoolStats(): CloudSqlPoolStats {
  const pool = getCloudSqlPool();
  return readPoolStats(pool);
}
