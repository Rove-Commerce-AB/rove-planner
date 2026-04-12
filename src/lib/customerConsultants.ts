import "server-only";

import * as q from "./customerConsultantsQueries";

export type { CustomerConsultant } from "./customerConsultantsQueries";

export async function getConsultantsByCustomerId(customerId: string) {
  return q.getConsultantsByCustomerId(customerId);
}

export async function addConsultantToCustomer(
  customerId: string,
  consultantId: string
) {
  return q.addConsultantToCustomer(customerId, consultantId);
}

export async function removeConsultantFromCustomer(
  customerId: string,
  consultantId: string
) {
  return q.removeConsultantFromCustomer(customerId, consultantId);
}

export async function getCustomerIdsForConsultant(consultantId: string) {
  return q.getCustomerIdsForConsultant(consultantId);
}
