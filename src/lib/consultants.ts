import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "./appUsers";
import { addConsultantToCustomer } from "./customerConsultants";
import { getCustomerIdByName } from "./customers";
import * as q from "./consultantsQueries";

export type {
  ConsultantListItem,
  CreateConsultantInput,
  UpdateConsultantInput,
  ConsultantForEdit,
} from "./consultantsQueries";

const ROVE_CUSTOMER_NAME = "Rove";

/**
 * Internal consultants are linked to the Rove customer when it exists.
 * Returns the Rove customer id when a link was created (caller may revalidate paths).
 */
export async function linkNewInternalConsultantToRoveCustomer(
  consultantId: string,
  input: q.CreateConsultantInput
): Promise<string | null> {
  const isInternal = !(input.is_external ?? false);
  if (!isInternal) return null;
  const roveCustomerId = await getCustomerIdByName(ROVE_CUSTOMER_NAME);
  if (!roveCustomerId) return null;
  await addConsultantToCustomer(roveCustomerId, consultantId);
  return roveCustomerId;
}

export async function createConsultant(input: q.CreateConsultantInput) {
  const supabase = await createClient();
  return q.createConsultantQuery(supabase, input);
}

export async function updateConsultant(id: string, input: q.UpdateConsultantInput) {
  const supabase = await createClient();
  return q.updateConsultantQuery(supabase, id, input);
}

export async function deleteConsultant(id: string) {
  const supabase = await createClient();
  return q.deleteConsultantQuery(supabase, id);
}

export async function getConsultantByEmail(email: string) {
  const supabase = await createClient();
  return q.fetchConsultantByEmail(supabase, email);
}

export async function getConsultantForCurrentUser() {
  const user = await getCurrentAppUser();
  if (!user?.email) return null;
  const supabase = await createClient();
  return q.fetchConsultantByEmail(supabase, user.email);
}

export async function getConsultantById(id: string) {
  const supabase = await createClient();
  return q.fetchConsultantById(supabase, id);
}

export async function getConsultantsWithDefaultRole() {
  const supabase = await createClient();
  return q.fetchConsultantsWithDefaultRole(supabase);
}

export async function getConsultantsList() {
  const supabase = await createClient();
  return q.fetchConsultantsList(supabase);
}

export async function getConsultantNamesByIds(ids: string[]) {
  const supabase = await createClient();
  return q.fetchConsultantNamesByIds(supabase, ids);
}

export async function getAvailableHoursForConsultantWeek(
  consultantId: string,
  year: number,
  week: number
) {
  const supabase = await createClient();
  return q.fetchAvailableHoursForConsultantWeek(
    supabase,
    consultantId,
    year,
    week
  );
}

export async function getConsultantsWithDetails(year: number, week: number) {
  const supabase = await createClient();
  return q.fetchConsultantsWithDetails(supabase, year, week);
}
