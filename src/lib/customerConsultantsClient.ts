"use server";

import * as q from "./customerConsultantsQueries";

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
