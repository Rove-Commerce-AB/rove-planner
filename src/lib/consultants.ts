import "server-only";

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
  return q.createConsultantQuery(input);
}

export async function updateConsultant(id: string, input: q.UpdateConsultantInput) {
  return q.updateConsultantQuery(id, input);
}

export async function deleteConsultant(id: string) {
  return q.deleteConsultantQuery(id);
}

export async function getConsultantByEmail(email: string) {
  return q.fetchConsultantByEmail(email);
}

export async function getConsultantForCurrentUser() {
  const user = await getCurrentAppUser();
  if (!user?.email) return null;
  return q.fetchConsultantByEmail(user.email);
}

export async function getConsultantById(id: string) {
  return q.fetchConsultantById(id);
}

export async function getConsultantsWithDefaultRole() {
  return q.fetchConsultantsWithDefaultRole();
}

export async function getConsultantsList() {
  return q.fetchConsultantsList();
}

export async function getConsultantNamesByIds(ids: string[]) {
  return q.fetchConsultantNamesByIds(ids);
}

export async function getAvailableHoursForConsultantWeek(
  consultantId: string,
  year: number,
  week: number
) {
  return q.fetchAvailableHoursForConsultantWeek(consultantId, year, week);
}

export async function getConsultantsWithDetails(year: number, week: number) {
  return q.fetchConsultantsWithDetails(year, week);
}
