"use server";

import * as q from "./customerRatesQueries";
import { getCustomerById } from "./customers";
import { parseBillingCurrency } from "./currency";

export type { CustomerRate } from "./customerRatesQueries";

export async function getCustomerRates(customerId: string) {
  return q.fetchCustomerRates(customerId);
}

export async function createCustomerRate(
  customerId: string,
  roleId: string,
  ratePerHour: number,
  currency?: string
) {
  const customer = await getCustomerById(customerId);
  const billingCurrency = parseBillingCurrency(
    currency ?? customer?.billingCurrency
  );
  return q.createCustomerRateQuery(
    customerId,
    roleId,
    ratePerHour,
    billingCurrency
  );
}

export async function updateCustomerRate(id: string, ratePerHour: number) {
  return q.updateCustomerRateQuery(id, ratePerHour);
}

export async function deleteCustomerRate(id: string) {
  return q.deleteCustomerRateQuery(id);
}
