import "server-only";

import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import {
  CUSTOMER_STATUS_BODY_MAX_LENGTH,
  type TrafficLight,
} from "@/lib/customerStatusShared";

export type { TrafficLight } from "@/lib/customerStatusShared";
export { CUSTOMER_STATUS_BODY_MAX_LENGTH } from "@/lib/customerStatusShared";

export type CustomerStatusEntry = {
  id: string;
  traffic_light: TrafficLight;
  body: string;
  year: number;
  week: number;
  created_at: Date;
};

export type ActiveCustomerWithLatestStatus = {
  customerId: string;
  customerName: string;
  latest: CustomerStatusEntry | null;
};

function parseTrafficLight(value: string): TrafficLight | null {
  if (value === "red" || value === "yellow" || value === "green") return value;
  return null;
}

export async function listActiveCustomersWithLatestStatus(): Promise<
  ActiveCustomerWithLatestStatus[]
> {
  const { rows } = await cloudSqlPool.query<{
    customer_id: string;
    customer_name: string;
    entry_id: string | null;
    traffic_light: string | null;
    body: string | null;
    year: number | null;
    week: number | null;
    created_at: Date | null;
  }>(
    `SELECT
       c.id AS customer_id,
       c.name AS customer_name,
       e.id AS entry_id,
       e.traffic_light,
       e.body,
       e.year,
       e.week,
       e.created_at
     FROM customers c
     LEFT JOIN LATERAL (
       SELECT id, traffic_light, body, year, week, created_at
       FROM customer_status_entries
       WHERE customer_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) e ON true
     WHERE c.is_active = true
     ORDER BY c.name ASC`
  );

  return rows.map((r) => {
    const tl = r.traffic_light ? parseTrafficLight(r.traffic_light) : null;
    const latest =
      r.entry_id &&
      tl &&
      r.body != null &&
      r.year != null &&
      r.week != null &&
      r.created_at != null
        ? {
            id: r.entry_id,
            traffic_light: tl,
            body: r.body,
            year: r.year,
            week: r.week,
            created_at: r.created_at,
          }
        : null;
    return {
      customerId: r.customer_id,
      customerName: r.customer_name ?? "",
      latest,
    };
  });
}

export async function listCustomerStatusHistory(
  customerId: string
): Promise<CustomerStatusEntry[]> {
  const { rows: active } = await cloudSqlPool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM customers WHERE id = $1 AND is_active = true`,
    [customerId]
  );
  if (active.length === 0) return [];

  const { rows } = await cloudSqlPool.query<{
    id: string;
    traffic_light: string;
    body: string;
    year: number;
    week: number;
    created_at: Date;
  }>(
    `SELECT id, traffic_light, body, year, week, created_at
     FROM customer_status_entries
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  );

  const out: CustomerStatusEntry[] = [];
  for (const row of rows) {
    const tl = parseTrafficLight(row.traffic_light);
    if (!tl) continue;
    out.push({
      id: row.id,
      traffic_light: tl,
      body: row.body,
      year: row.year,
      week: row.week,
      created_at: row.created_at,
    });
  }
  return out;
}

export async function addCustomerStatusEntry(
  customerId: string,
  trafficLight: string,
  body: string
): Promise<void> {
  const tl = parseTrafficLight(trafficLight.trim());
  if (!tl) {
    throw new Error("Invalid traffic light.");
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }
  if (trimmed.length > CUSTOMER_STATUS_BODY_MAX_LENGTH) {
    throw new Error(
      `Comment must be at most ${CUSTOMER_STATUS_BODY_MAX_LENGTH} characters.`
    );
  }

  const { rows } = await cloudSqlPool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM customers WHERE id = $1 AND is_active = true`,
    [customerId]
  );
  if (rows.length === 0) {
    throw new Error("Customer not found or inactive.");
  }

  const { year, week } = getCurrentYearWeek();

  await cloudSqlPool.query(
    `INSERT INTO customer_status_entries (customer_id, traffic_light, body, year, week)
     VALUES ($1, $2, $3, $4, $5)`,
    [customerId, tl, trimmed, year, week]
  );
}

export async function updateCustomerStatusEntry(
  entryId: string,
  customerId: string,
  trafficLight: string,
  body: string
): Promise<void> {
  const tl = parseTrafficLight(trafficLight.trim());
  if (!tl) {
    throw new Error("Invalid traffic light.");
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }
  if (trimmed.length > CUSTOMER_STATUS_BODY_MAX_LENGTH) {
    throw new Error(
      `Comment must be at most ${CUSTOMER_STATUS_BODY_MAX_LENGTH} characters.`
    );
  }

  const result = await cloudSqlPool.query(
    `UPDATE customer_status_entries
     SET traffic_light = $1, body = $2
     WHERE id = $3 AND customer_id = $4
       AND EXISTS (
         SELECT 1 FROM customers c
         WHERE c.id = $4 AND c.is_active = true
       )`,
    [tl, trimmed, entryId, customerId]
  );

  if (result.rowCount === 0) {
    throw new Error("Entry not found or customer inactive.");
  }
}

export async function deleteCustomerStatusEntry(
  entryId: string,
  customerId: string
): Promise<void> {
  const result = await cloudSqlPool.query(
    `DELETE FROM customer_status_entries WHERE id = $1 AND customer_id = $2`,
    [entryId, customerId]
  );

  if (result.rowCount === 0) {
    throw new Error("Entry not found.");
  }
}
