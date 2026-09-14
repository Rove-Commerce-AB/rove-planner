import { timingSafeEqual } from "node:crypto";

export const SUBSCRIPTION_ID_LENGTH = 6;
export const MAX_LITIUM_VERSION_LENGTH = 200;
export const MAX_LITIUM_VERSION_ITEMS = 500;

export type LitiumVersionItem = {
  subscriptionId: string;
  version: string;
};

export type LitiumVersionInvalidItem = {
  index: number;
  error: string;
};

export type ParseLitiumVersionResult =
  | {
      ok: true;
      items: LitiumVersionItem[];
      invalid: LitiumVersionInvalidItem[];
    }
  | { ok: false; error: string };

export function litiumVersionApiKeyConfigured(): boolean {
  return Boolean(process.env.LITIUM_VERSION_API_KEY?.trim());
}

export function requestHasLitiumVersionApiKey(request: Request): boolean {
  const expected = process.env.LITIUM_VERSION_API_KEY?.trim();
  if (!expected) return false;
  const provided = readProvidedApiKey(request);
  if (!provided) return false;
  return secureStringEquals(provided, expected);
}

export function readProvidedApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice("bearer ".length).trim();
    return token || null;
  }
  return null;
}

export function secureStringEquals(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  const length = Math.max(leftBuf.length, rightBuf.length, 1);
  const leftPad = Buffer.alloc(length);
  const rightPad = Buffer.alloc(length);
  leftBuf.copy(leftPad);
  rightBuf.copy(rightPad);
  return (
    leftBuf.length === rightBuf.length && timingSafeEqual(leftPad, rightPad)
  );
}

export function parseSubscriptionIdInput(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isValidSubscriptionId(trimmed)) {
    throw new Error("Subscription ID must be exactly 6 characters");
  }
  return trimmed;
}

export function isValidSubscriptionId(value: string): boolean {
  return value.length === SUBSCRIPTION_ID_LENGTH && !/\s/.test(value);
}

export function parseLitiumVersionPayload(
  body: unknown
): ParseLitiumVersionResult {
  const rows = extractPayloadRows(body);
  if (rows == null) {
    return {
      ok: false,
      error: "Body must be a JSON array of { subscriptionId, version }.",
    };
  }
  if (rows.length === 0) {
    return { ok: false, error: "Body must include at least one item." };
  }
  if (rows.length > MAX_LITIUM_VERSION_ITEMS) {
    return {
      ok: false,
      error: `Body cannot contain more than ${MAX_LITIUM_VERSION_ITEMS} items.`,
    };
  }

  const invalid: LitiumVersionInvalidItem[] = [];
  const bySubscriptionId = new Map<string, LitiumVersionItem>();

  for (let index = 0; index < rows.length; index++) {
    const parsed = parseLitiumVersionRow(rows[index]);
    if (!parsed.ok) {
      invalid.push({ index, error: parsed.error });
      continue;
    }
    bySubscriptionId.set(
      parsed.item.subscriptionId.toLowerCase(),
      parsed.item
    );
  }

  const items = [...bySubscriptionId.values()];
  if (items.length === 0) {
    return {
      ok: false,
      error: invalid[0]?.error ?? "No valid items in body.",
    };
  }

  return { ok: true, items, invalid };
}

function extractPayloadRows(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== "object") return null;
  const record = body as { items?: unknown };
  if (Array.isArray(record.items)) return record.items;
  return null;
}

function parseLitiumVersionRow(
  row: unknown
): { ok: true; item: LitiumVersionItem } | { ok: false; error: string } {
  if (!row || typeof row !== "object") {
    return { ok: false, error: "Each item must be an object." };
  }
  const record = row as { subscriptionId?: unknown; version?: unknown };
  if (typeof record.subscriptionId !== "string") {
    return { ok: false, error: "subscriptionId must be a string." };
  }
  const subscriptionId = record.subscriptionId.trim();
  if (!isValidSubscriptionId(subscriptionId)) {
    return {
      ok: false,
      error: "subscriptionId must be exactly 6 characters.",
    };
  }
  if (typeof record.version !== "string") {
    return { ok: false, error: "version must be a string." };
  }
  const version = record.version.trim();
  if (!version) {
    return { ok: false, error: "version cannot be empty." };
  }
  if (version.length > MAX_LITIUM_VERSION_LENGTH) {
    return {
      ok: false,
      error: `version cannot be longer than ${MAX_LITIUM_VERSION_LENGTH} characters.`,
    };
  }
  return { ok: true, item: { subscriptionId, version } };
}
