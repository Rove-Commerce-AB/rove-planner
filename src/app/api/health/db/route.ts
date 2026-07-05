import type { NextRequest } from "next/server";
import {
  cloudSqlPool,
  getCloudSqlErrorDetails,
  getCloudSqlPoolStats,
} from "@/lib/cloudSqlPool";
import {
  noStoreJson,
  parseHealthTimeoutMs,
  requireHealthDiagnosticsToken,
  withHealthTimeout,
} from "@/app/api/health/_shared";

export const dynamic = "force-dynamic";

const DEFAULT_DB_HEALTH_TIMEOUT_MS = 3_000;

type DbHealthRow = {
  ok: number;
  db_now: string;
};

export async function GET(request: NextRequest) {
  const denied = requireHealthDiagnosticsToken(request);
  if (denied) return denied;

  const timeoutMs = parseHealthTimeoutMs(
    request,
    DEFAULT_DB_HEALTH_TIMEOUT_MS
  );
  const startedAt = Date.now();
  const beforePool = getCloudSqlPoolStats();

  try {
    const result = await withHealthTimeout(
      cloudSqlPool.query<DbHealthRow>("SELECT 1 AS ok, now()::text AS db_now"),
      timeoutMs,
      `db health query timeout after ${timeoutMs}ms`
    );
    return noStoreJson({
      status: "ok",
      check: "db",
      durationMs: Date.now() - startedAt,
      timeoutMs,
      db: {
        ok: result.rows[0]?.ok === 1,
        now: result.rows[0]?.db_now ?? null,
      },
      pool: {
        before: beforePool,
        after: getCloudSqlPoolStats(),
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        status: "unavailable",
        check: "db",
        durationMs: Date.now() - startedAt,
        timeoutMs,
        error: getCloudSqlErrorDetails(error),
        pool: {
          before: beforePool,
          after: getCloudSqlPoolStats(),
        },
      },
      503
    );
  }
}
