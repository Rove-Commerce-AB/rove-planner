import { createClient } from "@/lib/supabase/client";
import * as q from "./customerConsultantsQueries";

export type { CustomerConsultant } from "./customerConsultantsQueries";

export async function addConsultantToCustomer(
  customerId: string,
  consultantId: string
) {
  const supabase = createClient();
  return q.addConsultantToCustomer(supabase, customerId, consultantId);
}

export async function removeConsultantFromCustomer(
  customerId: string,
  consultantId: string
) {
  const supabase = createClient();
  return q.removeConsultantFromCustomer(supabase, customerId, consultantId);
}
