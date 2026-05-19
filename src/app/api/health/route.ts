import { NextResponse } from "next/server";
import { cloudSqlPool } from "@/lib/cloudSqlPool";

export const dynamic = "force-dynamic";

const HEALTH_QUERY_TIMEOUT_MS = 3_000;

export async function GET() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const queryPromise = cloudSqlPool.query("SELECT 1 AS ok");
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("health check query timeout")),
        HEALTH_QUERY_TIMEOUT_MS
      );
    });
    await Promise.race([queryPromise, timeoutPromise]);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
