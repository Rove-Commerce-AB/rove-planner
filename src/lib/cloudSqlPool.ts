import "server-only";
import { Pool, type PoolClient, type PoolConfig } from "pg";
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

/** True for errors where retrying or serving stale session may be reasonable. */
export function isTransientCloudSqlConnectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("timeout exceeded when trying to connect") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up") ||
    msg.includes("connection terminated unexpectedly") ||
    msg.includes("pool acquire timeout")
  );
}

function classifyDbTimeoutError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const err = error as Error & { code?: string };
  const msg = error.message.toLowerCase();
  if (err.code === "57014" && msg.includes("statement timeout")) {
    return "statement_timeout";
  }
  if (err.code === "55P03" && msg.includes("lock timeout")) {
    return "lock_timeout";
  }
  if (msg.includes("query read timeout")) return "query_timeout";
  if (msg.includes("idle-in-transaction timeout")) {
    return "idle_in_transaction_timeout";
  }
  if (msg.includes("timeout exceeded when trying to connect")) {
    return "connection_timeout";
  }
  if (msg.includes("pool acquire timeout")) return "pool_acquire_timeout";
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildCloudSqlPoolConfig(): PoolConfig {
  const connectionString = process.env.CLOUD_SQL_URL;
  if (!connectionString) {
    throw new Error("CLOUD_SQL_URL is not set");
  }

  const sslMode = getSslMode(connectionString);
  const parsed = parse(stripSslModeQuery(connectionString));
  const { ssl: parsedSsl, ...rest } = parsed;
  void parsedSsl;

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
    (isProd ? 15_000 : undefined);
  const statementTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_STATEMENT_TIMEOUT_MS) ?? 30_000;
  const lockTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_LOCK_TIMEOUT_MS) ?? 5_000;
  const idleInTransactionSessionTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_IDLE_IN_TRANSACTION_TIMEOUT_MS) ??
    30_000;
  const queryTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_QUERY_TIMEOUT_MS) ?? 35_000;
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
    statement_timeout: statementTimeout,
    lock_timeout: lockTimeout,
    idle_in_transaction_session_timeout: idleInTransactionSessionTimeout,
    query_timeout: queryTimeout,
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

function getAcquireTimeoutMs(): number {
  return parsePositiveInt(process.env.CLOUD_SQL_ACQUIRE_TIMEOUT_MS) ?? 20_000;
}

function poolStats(pool: Pool): Record<string, number> {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

export function getCloudSqlPoolStats(): Record<string, number | boolean> {
  if (!poolSingleton) {
    return {
      initialized: false,
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };
  }

  return {
    initialized: true,
    ...poolStats(poolSingleton),
  };
}

export function getCloudSqlPoolConfigSummary(): Record<string, unknown> {
  const connectionString = process.env.CLOUD_SQL_URL;
  const isProd = process.env.NODE_ENV === "production";
  let connectionMode: "unset" | "unix_socket" | "tcp" | "unknown" = "unset";
  let sslMode: string | null = null;

  if (connectionString) {
    sslMode = getSslMode(connectionString);
    try {
      const parsed = parse(stripSslModeQuery(connectionString));
      connectionMode = (parsed.host ?? "").startsWith("/cloudsql/")
        ? "unix_socket"
        : "tcp";
    } catch {
      connectionMode = "unknown";
    }
  }

  const keepAliveEnabled =
    process.env.CLOUD_SQL_KEEP_ALIVE === "false" ? false : true;

  return {
    hasConnectionString: Boolean(connectionString),
    connectionMode,
    enforceUnixSocket:
      isProd && process.env.CLOUD_SQL_ENFORCE_UNIX_SOCKET !== "false",
    sslMode,
    useSsl:
      connectionString != null
        ? sslMode !== "disable" && connectionMode === "tcp"
        : null,
    rejectUnauthorized:
      process.env.CLOUD_SQL_SSL_REJECT_UNAUTHORIZED === "true",
    poolMax: parsePositiveInt(process.env.CLOUD_SQL_POOL_MAX) ?? (isProd ? 5 : 10),
    idleTimeoutMillis:
      parsePositiveInt(process.env.CLOUD_SQL_IDLE_TIMEOUT_MS) ??
      (isProd ? 20_000 : null),
    connectionTimeoutMillis:
      parsePositiveInt(process.env.CLOUD_SQL_CONNECTION_TIMEOUT_MS) ??
      (isProd ? 15_000 : null),
    acquireTimeoutMillis: getAcquireTimeoutMs(),
    statementTimeoutMillis:
      parsePositiveInt(process.env.CLOUD_SQL_STATEMENT_TIMEOUT_MS) ?? 30_000,
    lockTimeoutMillis:
      parsePositiveInt(process.env.CLOUD_SQL_LOCK_TIMEOUT_MS) ?? 5_000,
    idleInTransactionTimeoutMillis:
      parsePositiveInt(process.env.CLOUD_SQL_IDLE_IN_TRANSACTION_TIMEOUT_MS) ??
      30_000,
    queryTimeoutMillis:
      parsePositiveInt(process.env.CLOUD_SQL_QUERY_TIMEOUT_MS) ?? 35_000,
    keepAlive: keepAliveEnabled,
    keepAliveInitialDelayMillis:
      parsePositiveInt(process.env.CLOUD_SQL_KEEP_ALIVE_INITIAL_DELAY_MS) ??
      10_000,
    queryRetryCount:
      parsePositiveInt(process.env.CLOUD_SQL_QUERY_RETRY_COUNT) ?? 2,
    queryRetryDelayMs:
      parsePositiveInt(process.env.CLOUD_SQL_QUERY_RETRY_DELAY_MS) ?? 150,
    debugLogs: process.env.APP_DEBUG_LOGS === "1",
  };
}

export function getCloudSqlErrorDetails(error: unknown): Record<string, unknown> {
  const timeoutKind = classifyDbTimeoutError(error);
  if (error instanceof Error) {
    const err = error as Error & { code?: string };
    return {
      error: error.message,
      code: err.code ?? null,
      timeoutKind,
    };
  }
  return {
    error: String(error),
    timeoutKind,
  };
}

function errorDetails(error: unknown): Record<string, unknown> {
  return getCloudSqlErrorDetails(error);
}

async function connectWithAcquireTimeout(
  pool: Pool,
  acquireTimeoutMs = getAcquireTimeoutMs()
): Promise<PoolClient> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const connectPromise = pool.connect();
  connectPromise.then(
    (client) => {
      if (timedOut) {
        client.release();
      }
    },
    () => {}
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Pool acquire timeout after ${acquireTimeoutMs}ms (waitingCount=${pool.waitingCount}, totalCount=${pool.totalCount}, idleCount=${pool.idleCount})`
        )
      );
    }, acquireTimeoutMs);
  });

  try {
    return await Promise.race([connectPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function runQueryWithAcquireTimeout(
  pool: Pool,
  args: unknown[]
): Promise<unknown> {
  const acquireTimeoutMs = getAcquireTimeoutMs();
  const execute = () =>
    (pool.query as (...innerArgs: unknown[]) => Promise<unknown>)(...args);

  if (pool.waitingCount <= 0) {
    return execute();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Pool acquire timeout after ${acquireTimeoutMs}ms (waitingCount=${pool.waitingCount}, totalCount=${pool.totalCount}, idleCount=${pool.idleCount})`
        )
      );
    }, acquireTimeoutMs);
  });

  try {
    return await Promise.race([execute(), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function withCloudSqlClient<T>(
  label: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getCloudSqlPool();
  const start = Date.now();
  let client: PoolClient | null = null;
  debugLog("db-client", `${label} acquire start`, poolStats(pool));

  try {
    client = await connectWithAcquireTimeout(pool);
    const acquiredAt = Date.now();
    debugLog("db-client", `${label} acquired`, {
      durationMs: acquiredAt - start,
      ...poolStats(pool),
    });
    const result = await fn(client);
    debugLog("db-client", `${label} ok`, {
      durationMs: Date.now() - start,
      workDurationMs: Date.now() - acquiredAt,
      ...poolStats(pool),
    });
    return result;
  } catch (error) {
    debugLog(
      "db-client",
      `${label} failed`,
      {
        durationMs: Date.now() - start,
        ...poolStats(pool),
        ...errorDetails(error),
      },
      "error"
    );
    throw error;
  } finally {
    if (client) {
      client.release();
      debugLog("db-client", `${label} released`, poolStats(pool));
    }
  }
}

export async function withCloudSqlDiagnosticClient<T>(
  label: string,
  fn: (client: PoolClient) => Promise<T>,
  timeoutMs = 3_000
): Promise<T> {
  const baseConfig = buildCloudSqlPoolConfig();
  const connectionTimeoutMillis =
    parsePositiveInt(process.env.CLOUD_SQL_DIAGNOSTIC_CONNECTION_TIMEOUT_MS) ??
    timeoutMs;
  const statementTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_DIAGNOSTIC_STATEMENT_TIMEOUT_MS) ??
    timeoutMs;
  const lockTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_DIAGNOSTIC_LOCK_TIMEOUT_MS) ??
    Math.min(timeoutMs, 1_000);
  const queryTimeout =
    parsePositiveInt(process.env.CLOUD_SQL_DIAGNOSTIC_QUERY_TIMEOUT_MS) ??
    timeoutMs;
  const baseApplicationName =
    typeof baseConfig.application_name === "string" &&
    baseConfig.application_name.trim()
      ? baseConfig.application_name.trim()
      : "rove-planner";
  const diagnosticPool = new Pool({
    ...baseConfig,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis,
    statement_timeout: statementTimeout,
    lock_timeout: lockTimeout,
    query_timeout: queryTimeout,
    application_name: `${baseApplicationName}:health-diagnostics`,
  });
  const start = Date.now();
  let client: PoolClient | null = null;
  debugLog("db-client", `${label} diagnostic acquire start`);

  try {
    client = await connectWithAcquireTimeout(
      diagnosticPool,
      connectionTimeoutMillis
    );
    const acquiredAt = Date.now();
    debugLog("db-client", `${label} diagnostic acquired`, {
      durationMs: acquiredAt - start,
    });
    const result = await fn(client);
    debugLog("db-client", `${label} diagnostic ok`, {
      durationMs: Date.now() - start,
      workDurationMs: Date.now() - acquiredAt,
    });
    return result;
  } catch (error) {
    debugLog(
      "db-client",
      `${label} diagnostic failed`,
      {
        durationMs: Date.now() - start,
        ...errorDetails(error),
      },
      "error"
    );
    throw error;
  } finally {
    if (client) client.release();
    await diagnosticPool.end().catch((error: unknown) => {
      debugLog(
        "db-client",
        `${label} diagnostic pool close failed`,
        errorDetails(error),
        "error"
      );
    });
  }
}

class TransactionRollback<T> extends Error {
  constructor(readonly value: T) {
    super("Transaction rollback requested");
    this.name = "TransactionRollback";
  }
}

export async function withCloudSqlTransaction<T>(
  label: string,
  fn: (
    client: PoolClient,
    rollback: (value: T) => Promise<never>
  ) => Promise<T>
): Promise<T> {
  return withCloudSqlClient(label, async (client) => {
    let finished = false;

    const rollback = async (value: T): Promise<never> => {
      await client.query("ROLLBACK");
      finished = true;
      throw new TransactionRollback(value);
    };

    try {
      await client.query("BEGIN");
      const result = await fn(client, rollback);
      await client.query("COMMIT");
      finished = true;
      return result;
    } catch (error) {
      if (error instanceof TransactionRollback) {
        return error.value as T;
      }
      if (!finished) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          debugLog(
            "db-client",
            `${label} rollback failed`,
            errorDetails(rollbackError),
            "error"
          );
        }
      }
      throw error;
    }
  });
}

/**
 * Keep the existing import surface (`cloudSqlPool.query(...)`) but avoid
 * constructing the DB pool at module-load time, which can happen during build.
 */
export const cloudSqlPool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    if (prop === "query") {
      return async (...args: unknown[]) => {
        const pool = getCloudSqlPool();
        const retryCount = parsePositiveInt(process.env.CLOUD_SQL_QUERY_RETRY_COUNT) ?? 2;
        const retryDelayMs = parsePositiveInt(process.env.CLOUD_SQL_QUERY_RETRY_DELAY_MS) ?? 150;

        let attempt = 0;
        while (attempt <= retryCount) {
          try {
            return await runQueryWithAcquireTimeout(pool, args);
          } catch (error) {
            const canRetry =
              isTransientCloudSqlConnectError(error) && attempt < retryCount;
            if (!canRetry) {
              if (
                error instanceof Error &&
                error.message.includes("Pool acquire timeout")
              ) {
                debugLog(
                  "db-pool",
                  "pool acquire timeout",
                  {
                    waitingCount: pool.waitingCount,
                    totalCount: pool.totalCount,
                    idleCount: pool.idleCount,
                  },
                  "error"
                );
              }
              throw error;
            }

            debugLog("db-pool", "query retry after connect timeout", {
              attempt: attempt + 1,
              retryCount,
              retryDelayMs,
            });
            await sleep(retryDelayMs);
            attempt += 1;
          }
        }
      };
    }
    return Reflect.get(getCloudSqlPool(), prop, receiver);
  },
});
