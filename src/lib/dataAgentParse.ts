export type DataAgentTable = { headers: string[]; rows: unknown[][] };

export type DataAgentAnswer = { text: string; table: DataAgentTable | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, key: string, snakeKey?: string): unknown {
  if (!isRecord(value)) return undefined;
  if (key in value) return value[key];
  if (snakeKey && snakeKey in value) return value[snakeKey];
  return undefined;
}

/** Parse a chat response body that is either JSON, a JSON array, or NDJSON. */
export function parseStreamEvents(body: string): unknown[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const events: unknown[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      events.push(JSON.parse(t) as unknown);
    }
    return events;
  }
}

function getSystemMessage(event: unknown): Record<string, unknown> | null {
  if (!isRecord(event)) return null;

  const direct = asRecord(event, "systemMessage", "system_message");
  if (isRecord(direct)) return direct;

  const nestedMessage = asRecord(event, "message");
  if (isRecord(nestedMessage)) {
    const inner = asRecord(nestedMessage, "systemMessage", "system_message");
    if (isRecord(inner)) return inner;
  }

  return null;
}

function unwrapProtoValue(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(unwrapProtoValue);

  const rec = value as Record<string, unknown>;
  if ("stringValue" in rec) return rec.stringValue;
  if ("numberValue" in rec) return rec.numberValue;
  if ("boolValue" in rec) return rec.boolValue;
  if ("nullValue" in rec) return null;
  if ("listValue" in rec) {
    const list = rec.listValue;
    if (isRecord(list) && Array.isArray(list.values)) {
      return list.values.map(unwrapProtoValue);
    }
    if (Array.isArray(list)) return list.map(unwrapProtoValue);
  }
  if ("structValue" in rec) return unwrapProtoValue(rec.structValue);
  if (isRecord(rec.fields)) {
    const out: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(rec.fields)) {
      out[key] = unwrapProtoValue(fieldValue);
    }
    return out;
  }
  return value;
}

function schemaHeaders(schema: unknown): string[] {
  if (!isRecord(schema)) return [];
  const fields = schema.fields;
  if (!Array.isArray(fields)) return [];
  return fields.map((field, index) => {
    if (isRecord(field) && typeof field.name === "string" && field.name) {
      return field.name;
    }
    return `column_${index + 1}`;
  });
}

function rowToArray(row: unknown, headers: string[]): unknown[] {
  if (Array.isArray(row)) return row.map(unwrapProtoValue);

  const unwrapped = unwrapProtoValue(row);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (isRecord(unwrapped) && headers.length > 0) {
    return headers.map((header) =>
      header in unwrapped ? unwrapped[header] : null
    );
  }
  return [unwrapped];
}

function parseTable(result: unknown): DataAgentTable | null {
  if (!isRecord(result)) return null;
  const headers = schemaHeaders(result.schema);
  const data = result.data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const rows = data.map((row) => rowToArray(row, headers));
  const resolvedHeaders =
    headers.length > 0
      ? headers
      : rows[0].map((_, index) => `column_${index + 1}`);
  return { headers: resolvedHeaders, rows };
}

/**
 * Reduce a stream of Conversational Analytics messages to answer text + table.
 * Uses the last `systemMessage.text.parts` and the last `data.result` table.
 * Intermediate tool errors are ignored when a final text/table exists.
 */
export function parseDataAgentStream(body: string): DataAgentAnswer {
  const events = parseStreamEvents(body);

  let lastText: string | null = null;
  let lastTable: DataAgentTable | null = null;
  let lastError: string | null = null;

  for (const event of events) {
    const systemMessage = getSystemMessage(event);
    if (!systemMessage) continue;

    const text = asRecord(systemMessage, "text");
    if (isRecord(text) && Array.isArray(text.parts)) {
      const parts = text.parts.filter(
        (part): part is string => typeof part === "string"
      );
      if (parts.length > 0) {
        lastText = parts.join("\n");
      }
    }

    const data = asRecord(systemMessage, "data");
    if (isRecord(data)) {
      const result = asRecord(data, "result");
      const table = parseTable(result);
      if (table) lastTable = table;
    }

    const error = asRecord(systemMessage, "error");
    if (isRecord(error) && typeof error.text === "string" && error.text) {
      lastError = error.text;
    }
  }

  if (lastText == null && lastTable == null) {
    throw new Error(lastError ?? "The data agent did not return an answer");
  }

  return { text: lastText ?? "", table: lastTable };
}
