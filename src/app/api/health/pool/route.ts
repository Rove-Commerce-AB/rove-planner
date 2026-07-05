import type { NextRequest } from "next/server";
import {
  getCloudSqlPoolConfigSummary,
  getCloudSqlPoolStats,
} from "@/lib/cloudSqlPool";
import {
  noStoreJson,
  requireHealthDiagnosticsToken,
} from "@/app/api/health/_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireHealthDiagnosticsToken(request);
  if (denied) return denied;

  return noStoreJson({
    status: "ok",
    check: "pool",
    now: new Date().toISOString(),
    pool: getCloudSqlPoolStats(),
    config: getCloudSqlPoolConfigSummary(),
  });
}
