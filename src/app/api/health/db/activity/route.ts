import type { NextRequest } from "next/server";
import {
  getCloudSqlErrorDetails,
  getCloudSqlPoolStats,
  withCloudSqlDiagnosticClient,
} from "@/lib/cloudSqlPool";
import {
  noStoreJson,
  parseHealthTimeoutMs,
  requireHealthDiagnosticsToken,
  toInteger,
} from "@/app/api/health/_shared";

export const dynamic = "force-dynamic";

const DEFAULT_ACTIVITY_TIMEOUT_MS = 3_000;

type DbActivityRow = {
  total_sessions: number | string;
  active_sessions: number | string;
  idle_sessions: number | string;
  idle_in_transaction_sessions: number | string;
  waiting_sessions: number | string;
  lock_waiting_sessions: number | string;
  client_waiting_sessions: number | string;
  max_active_query_ms: number | string | null;
  max_transaction_ms: number | string | null;
};

const ACTIVITY_SQL = `
  SELECT
    count(*)::int AS total_sessions,
    count(*) FILTER (WHERE state = 'active')::int AS active_sessions,
    count(*) FILTER (WHERE state = 'idle')::int AS idle_sessions,
    count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_in_transaction_sessions,
    count(*) FILTER (WHERE wait_event_type IS NOT NULL)::int AS waiting_sessions,
    count(*) FILTER (WHERE wait_event_type = 'Lock')::int AS lock_waiting_sessions,
    count(*) FILTER (WHERE wait_event_type = 'Client')::int AS client_waiting_sessions,
    COALESCE(
      ceil(max(extract(epoch FROM now() - query_start) * 1000)
        FILTER (WHERE state = 'active')),
      0
    )::int AS max_active_query_ms,
    COALESCE(
      ceil(max(extract(epoch FROM now() - xact_start) * 1000)
        FILTER (WHERE xact_start IS NOT NULL)),
      0
    )::int AS max_transaction_ms
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
`;

export async function GET(request: NextRequest) {
  const denied = requireHealthDiagnosticsToken(request);
  if (denied) return denied;

  const timeoutMs = parseHealthTimeoutMs(request, DEFAULT_ACTIVITY_TIMEOUT_MS);
  const startedAt = Date.now();
  const beforePool = getCloudSqlPoolStats();

  try {
    const result = await withCloudSqlDiagnosticClient(
      "health db activity",
      (client) => client.query<DbActivityRow>(ACTIVITY_SQL),
      timeoutMs
    );
    const row = result.rows[0];
    const activity = {
      totalSessions: toInteger(row?.total_sessions),
      activeSessions: toInteger(row?.active_sessions),
      idleSessions: toInteger(row?.idle_sessions),
      idleInTransactionSessions: toInteger(row?.idle_in_transaction_sessions),
      waitingSessions: toInteger(row?.waiting_sessions),
      lockWaitingSessions: toInteger(row?.lock_waiting_sessions),
      clientWaitingSessions: toInteger(row?.client_waiting_sessions),
      maxActiveQueryMs: toInteger(row?.max_active_query_ms),
      maxTransactionMs: toInteger(row?.max_transaction_ms),
    };
    const degraded =
      activity.lockWaitingSessions > 0 ||
      activity.idleInTransactionSessions > 0 ||
      activity.maxTransactionMs > 30_000;

    return noStoreJson({
      status: degraded ? "degraded" : "ok",
      check: "db-activity",
      durationMs: Date.now() - startedAt,
      timeoutMs,
      activity,
      pool: {
        before: beforePool,
        after: getCloudSqlPoolStats(),
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        status: "unavailable",
        check: "db-activity",
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
