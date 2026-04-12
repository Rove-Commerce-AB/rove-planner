import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type CustomerRate = {
  id: string;
  customer_id: string;
  role_id: string;
  rate_per_hour: number;
  currency: string;
};

function mapRow(r: {
  id: string;
  customer_id: string;
  role_id: string;
  rate_per_hour: string | number;
  currency: string | null;
}): CustomerRate {
  return {
    id: r.id,
    customer_id: r.customer_id,
    role_id: r.role_id,
    rate_per_hour: Number(r.rate_per_hour),
    currency: r.currency ?? "SEK",
  };
}

export async function fetchCustomerRates(
  customerId: string
): Promise<CustomerRate[]> {
  const { rows } = await cloudSqlPool.query(
    `SELECT id, customer_id, role_id, rate_per_hour, currency
     FROM customer_rates WHERE customer_id = $1`,
    [customerId]
  );
  return rows.map(mapRow);
}

export async function fetchCustomerRatesByCustomerIds(
  customerIds: string[]
): Promise<CustomerRate[]> {
  if (customerIds.length === 0) return [];

  const { rows } = await cloudSqlPool.query(
    `SELECT id, customer_id, role_id, rate_per_hour, currency
     FROM customer_rates WHERE customer_id = ANY($1::uuid[])`,
    [customerIds]
  );
  return rows.map(mapRow);
}

export async function createCustomerRateQuery(
  customerId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
): Promise<CustomerRate> {
  const { rows } = await cloudSqlPool.query(
    `INSERT INTO customer_rates (customer_id, role_id, rate_per_hour, currency)
     VALUES ($1, $2, $3, $4)
     RETURNING id, customer_id, role_id, rate_per_hour, currency`,
    [customerId, roleId, ratePerHour, currency]
  );
  if (!rows[0]) throw new Error("Failed to create customer rate");
  return mapRow(rows[0] as Parameters<typeof mapRow>[0]);
}

export async function updateCustomerRateQuery(
  id: string,
  ratePerHour: number
): Promise<CustomerRate> {
  const { rows } = await cloudSqlPool.query(
    `UPDATE customer_rates SET rate_per_hour = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, customer_id, role_id, rate_per_hour, currency`,
    [id, ratePerHour]
  );
  if (!rows[0]) throw new Error("Failed to update customer rate");
  return mapRow(rows[0] as Parameters<typeof mapRow>[0]);
}

export async function deleteCustomerRateQuery(id: string): Promise<void> {
  await cloudSqlPool.query(`DELETE FROM customer_rates WHERE id = $1`, [id]);
}
