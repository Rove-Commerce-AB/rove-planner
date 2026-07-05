import type { NextRequest } from "next/server";
import {
  noStoreJson,
  requireHealthDiagnosticsToken,
} from "@/app/api/health/_shared";

export const dynamic = "force-dynamic";

function bytesToMb(value: number): number {
  return Math.round((value / 1024 / 1024) * 10) / 10;
}

export async function GET(request: NextRequest) {
  const denied = requireHealthDiagnosticsToken(request);
  if (denied) return denied;

  const memory = process.memoryUsage();
  return noStoreJson({
    status: "ok",
    check: "runtime",
    now: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? null,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: {
      rss: bytesToMb(memory.rss),
      heapTotal: bytesToMb(memory.heapTotal),
      heapUsed: bytesToMb(memory.heapUsed),
      external: bytesToMb(memory.external),
      arrayBuffers: bytesToMb(memory.arrayBuffers),
    },
  });
}
