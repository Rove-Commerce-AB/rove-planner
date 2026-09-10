import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type CustomerConsultant = {
  id: string;
  name: string;
};

export type CustomerConsultantsByCustomerId = Record<
  string,
  CustomerConsultant[]
>;

export async function getConsultantsByCustomerIds(
  customerIds: string[]
): Promise<CustomerConsultantsByCustomerId> {
  const uniqueCustomerIds = [...new Set(customerIds)].filter(Boolean);
  if (uniqueCustomerIds.length === 0) return {};

  const { rows } = await cloudSqlPool.query<{
    customer_id: string;
    id: string;
    name: string;
  }>(
    `SELECT cc.customer_id, c.id, c.name
     FROM customer_consultants cc
     JOIN consultants c ON c.id = cc.consultant_id
     WHERE cc.customer_id = ANY($1::uuid[])
     ORDER BY c.name`,
    [uniqueCustomerIds]
  );

  const result: CustomerConsultantsByCustomerId = Object.fromEntries(
    uniqueCustomerIds.map((customerId) => [customerId, []])
  );
  for (const row of rows) {
    result[row.customer_id]?.push({ id: row.id, name: row.name });
  }
  return result;
}

export async function getConsultantsByCustomerId(
  customerId: string
): Promise<CustomerConsultant[]> {
  const { rows: linkRows } = await cloudSqlPool.query<{ consultant_id: string }>(
    `SELECT consultant_id FROM customer_consultants WHERE customer_id = $1`,
    [customerId]
  );

  const consultantIds = linkRows.map((r) => r.consultant_id);
  if (consultantIds.length === 0) return [];

  const { rows: consultants } = await cloudSqlPool.query<{
    id: string;
    name: string;
  }>(
    `SELECT id, name FROM consultants WHERE id = ANY($1::uuid[]) ORDER BY name`,
    [consultantIds]
  );

  return consultants.map((c) => ({ id: c.id, name: c.name }));
}

export async function addConsultantToCustomer(
  customerId: string,
  consultantId: string
): Promise<void> {
  await cloudSqlPool.query(
    `INSERT INTO customer_consultants (customer_id, consultant_id) VALUES ($1, $2)`,
    [customerId, consultantId]
  );
}

export async function removeConsultantFromCustomer(
  customerId: string,
  consultantId: string
): Promise<void> {
  await cloudSqlPool.query(
    `DELETE FROM customer_consultants WHERE customer_id = $1 AND consultant_id = $2`,
    [customerId, consultantId]
  );
}

export async function getCustomerIdsForConsultant(
  consultantId: string
): Promise<string[]> {
  const { rows } = await cloudSqlPool.query<{ customer_id: string }>(
    `SELECT customer_id FROM customer_consultants WHERE consultant_id = $1`,
    [consultantId]
  );
  return rows.map((r) => r.customer_id);
}
