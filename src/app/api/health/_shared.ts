import { NextResponse, type NextRequest } from "next/server";

const MAX_HEALTH_TIMEOUT_MS = 10_000;

export function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function requireHealthDiagnosticsToken(
  request: NextRequest
): NextResponse | null {
  const expected = process.env.HEALTHCHECK_DIAGNOSTICS_TOKEN?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return noStoreJson(
        {
          status: "forbidden",
          error:
            "HEALTHCHECK_DIAGNOSTICS_TOKEN must be set to use detailed health endpoints in production.",
        },
        403
      );
    }
    return null;
  }

  const headerToken = request.headers.get("x-health-token")?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : null;

  if (headerToken === expected || bearerToken === expected) {
    return null;
  }

  return noStoreJson(
    {
      status: "forbidden",
      error: "Detailed health endpoint requires x-health-token or Bearer token.",
    },
    403
  );
}

export function parseHealthTimeoutMs(
  request: NextRequest,
  fallbackMs: number
): number {
  const raw = request.nextUrl.searchParams.get("timeoutMs");
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.min(Math.floor(parsed), MAX_HEALTH_TIMEOUT_MS);
}

export async function withHealthTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function toInteger(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}
