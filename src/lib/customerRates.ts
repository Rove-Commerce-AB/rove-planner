import "server-only";

import * as q from "./customerRatesQueries";
import { getCustomerById } from "./customers";
import { parseBillingCurrency } from "./currency";

export type { CustomerRate } from "./customerRatesQueries";

export async function getCustomerRates(customerId: string) {
  return q.fetchCustomerRates(customerId);
}

export async function getCustomerRatesByCustomerIds(
  customerIds: string[],
  opts?: { includeInactive?: boolean }
) {
  return q.fetchCustomerRatesByCustomerIds(customerIds, opts);
}

export async function createCustomerRate(
  customerId: string,
  input: {
    roleId?: string | null;
    name?: string | null;
    ratePerHour: number;
    currency?: string;
  }
) {
  const customer = await getCustomerById(customerId);
  const billingCurrency = parseBillingCurrency(
    input.currency ?? customer?.billingCurrency
  );
  return q.createCustomerRateQuery(customerId, {
    ...input,
    currency: billingCurrency,
  });
}

export async function updateCustomerRate(id: string, ratePerHour: number) {
  return q.updateCustomerRateQuery(id, ratePerHour);
}

export async function deleteCustomerRate(id: string) {
  return q.deleteCustomerRateQuery(id);
}
