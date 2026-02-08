import { supabase } from "./supabaseClient";

export type CustomerConsultant = {
  id: string;
  name: string;
};

/** Consultants assigned to this customer (for CONSULTANTS panel on customer page). */
export async function getConsultantsByCustomerId(
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

/** Assign a consultant to a customer. */
export async function addConsultantToCustomer(
  customerId: string,
  consultantId: string
): Promise<void> {
  const { error } = await supabase.from("customer_consultants").insert({
    customer_id: customerId,
    consultant_id: consultantId,
  });

  if (error) throw error;
}

/** Remove a consultant from a customer. */
export async function removeConsultantFromCustomer(
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

/** Customer IDs that have the given consultant assigned (for project filtering). */
export async function getCustomerIdsForConsultant(
  consultantId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("customer_consultants")
    .select("customer_id")
    .eq("consultant_id", consultantId);

  if (error) return [];
  return (data ?? []).map((r) => r.customer_id);
}
