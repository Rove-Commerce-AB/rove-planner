import { createClient } from "@/lib/supabase/client";
import * as q from "./customerRatesQueries";

export type { CustomerRate } from "./customerRatesQueries";

export async function getCustomerRates(customerId: string) {
  const supabase = createClient();
  return q.fetchCustomerRates(supabase, customerId);
}

export async function createCustomerRate(
  customerId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
) {
  const supabase = createClient();
  return q.createCustomerRateQuery(
    supabase,
    customerId,
    roleId,
    ratePerHour,
    currency
  );
}

export async function updateCustomerRate(id: string, ratePerHour: number) {
  const supabase = createClient();
  return q.updateCustomerRateQuery(supabase, id, ratePerHour);
}

export async function deleteCustomerRate(id: string) {
  const supabase = createClient();
  return q.deleteCustomerRateQuery(supabase, id);
}
