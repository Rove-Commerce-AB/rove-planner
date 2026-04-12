import "server-only";

import * as q from "./customerRatesQueries";

export type { CustomerRate } from "./customerRatesQueries";

export async function getCustomerRates(customerId: string) {
  return q.fetchCustomerRates(customerId);
}

export async function getCustomerRatesByCustomerIds(customerIds: string[]) {
  return q.fetchCustomerRatesByCustomerIds(customerIds);
}

export async function createCustomerRate(
  customerId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
) {
  return q.createCustomerRateQuery(
    customerId,
    roleId,
    ratePerHour,
    currency
  );
}

export async function updateCustomerRate(id: string, ratePerHour: number) {
  return q.updateCustomerRateQuery(id, ratePerHour);
}

export async function deleteCustomerRate(id: string) {
  return q.deleteCustomerRateQuery(id);
}
