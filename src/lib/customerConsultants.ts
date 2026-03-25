import "server-only";

import { createClient } from "@/lib/supabase/server";
import * as q from "./customerConsultantsQueries";

export type { CustomerConsultant } from "./customerConsultantsQueries";

export async function getConsultantsByCustomerId(customerId: string) {
  const supabase = await createClient();
  return q.getConsultantsByCustomerId(supabase, customerId);
}

export async function addConsultantToCustomer(
  customerId: string,
  consultantId: string
) {
  const supabase = await createClient();
  return q.addConsultantToCustomer(supabase, customerId, consultantId);
}

export async function removeConsultantFromCustomer(
  customerId: string,
  consultantId: string
) {
  const supabase = await createClient();
  return q.removeConsultantFromCustomer(supabase, customerId, consultantId);
}

export async function getCustomerIdsForConsultant(consultantId: string) {
  const supabase = await createClient();
  return q.getCustomerIdsForConsultant(supabase, consultantId);
}
