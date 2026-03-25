import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomerConsultant = {
  id: string;
  name: string;
};

export async function getConsultantsByCustomerId(
  supabase: SupabaseClient,
  customerId: string
): Promise<CustomerConsultant[]> {
  const { data, error } = await supabase
    .from("customer_consultants")
    .select("consultant_id")
    .eq("customer_id", customerId);

  if (error) return [];

  const consultantIds = (data ?? []).map((r) => r.consultant_id);
  if (consultantIds.length === 0) return [];

  const { data: consultants, error: consultantsError } = await supabase
    .from("consultants")
    .select("id,name")
    .in("id", consultantIds)
    .order("name");

  if (consultantsError || !consultants) return [];

  return consultants.map((c) => ({ id: c.id, name: c.name }));
}

export async function addConsultantToCustomer(
  supabase: SupabaseClient,
  customerId: string,
  consultantId: string
): Promise<void> {
  const { error } = await supabase.from("customer_consultants").insert({
    customer_id: customerId,
    consultant_id: consultantId,
  });

  if (error) throw error;
}

export async function removeConsultantFromCustomer(
  supabase: SupabaseClient,
  customerId: string,
  consultantId: string
): Promise<void> {
  const { error } = await supabase
    .from("customer_consultants")
    .delete()
    .eq("customer_id", customerId)
    .eq("consultant_id", consultantId);

  if (error) throw error;
}

export async function getCustomerIdsForConsultant(
  supabase: SupabaseClient,
  consultantId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("customer_consultants")
    .select("customer_id")
    .eq("consultant_id", consultantId);

  if (error) return [];
  return (data ?? []).map((r) => r.customer_id);
}
