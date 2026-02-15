import { supabase } from "./supabaseClient";

export type CustomerRate = {
  id: string;
  customer_id: string;
  role_id: string;
  rate_per_hour: number;
  currency: string;
};

export async function getCustomerRates(
  customerId: string
): Promise<CustomerRate[]> {
  const { data, error } = await supabase
    .from("customer_rates")
    .select("id,customer_id,role_id,rate_per_hour,currency")
    .eq("customer_id", customerId);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    customer_id: r.customer_id,
    role_id: r.role_id,
    rate_per_hour: Number(r.rate_per_hour),
    currency: r.currency ?? "SEK",
  }));
}

/** Fetch rates for multiple customers in one query. */
export async function getCustomerRatesByCustomerIds(
  customerIds: string[]
): Promise<CustomerRate[]> {
  if (customerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("customer_rates")
    .select("id,customer_id,role_id,rate_per_hour,currency")
    .in("customer_id", customerIds);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    customer_id: r.customer_id,
    role_id: r.role_id,
    rate_per_hour: Number(r.rate_per_hour),
    currency: r.currency ?? "SEK",
  }));
}

export async function createCustomerRate(
  customerId: string,
  roleId: string,
  ratePerHour: number,
  currency = "SEK"
): Promise<CustomerRate> {
  const { data, error } = await supabase
    .from("customer_rates")
    .insert({
      customer_id: customerId,
      role_id: roleId,
      rate_per_hour: ratePerHour,
      currency,
    })
    .select("id,customer_id,role_id,rate_per_hour,currency")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    customer_id: data.customer_id,
    role_id: data.role_id,
    rate_per_hour: Number(data.rate_per_hour),
    currency: data.currency ?? "SEK",
  };
}

export async function updateCustomerRate(
  id: string,
  ratePerHour: number
): Promise<CustomerRate> {
  const { data, error } = await supabase
    .from("customer_rates")
    .update({ rate_per_hour: ratePerHour })
    .eq("id", id)
    .select("id,customer_id,role_id,rate_per_hour,currency")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    customer_id: data.customer_id,
    role_id: data.role_id,
    rate_per_hour: Number(data.rate_per_hour),
    currency: data.currency ?? "SEK",
  };
}

export async function deleteCustomerRate(id: string): Promise<void> {
  const { error } = await supabase.from("customer_rates").delete().eq("id", id);

  if (error) throw error;
}
