import "server-only";

type LogLevel = "info" | "warn" | "error";

function isDebugEnabled(): boolean {
  return process.env.APP_DEBUG_LOGS === "1";
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function debugLog(
  scope: string,
  message: string,
  details?: Record<string, unknown>,
  level: LogLevel = "info"
) {
  if (!isDebugEnabled()) return;
  const prefix = `[debug:${scope}] ${message}`;
  if (!details) {
    console[level](prefix);
    return;
  }
  console[level](`${prefix} ${safeString(details)}`);
}

export async function timedDebug<T>(
  scope: string,
  label: string,
  fn: () => Promise<T>,
  details?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    debugLog(scope, `${label} ok`, { durationMs: Date.now() - start, ...details });
    return result;
  } catch (error) {
    debugLog(
      scope,
      `${label} failed`,
      {
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
        ...details,
      },
      "error"
    );
    throw error;
  }
}
