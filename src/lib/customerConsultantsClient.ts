"use server";

import { revalidatePath } from "next/cache";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";
import * as q from "./customerConsultantsQueries";
import { ROUTES, customerHref, personHref } from "@/lib/routes";

export async function addConsultantToCustomer(
  customerId: string,
  consultantId: string
) {
  await assertNotSubcontractorForWrite();
  await q.addConsultantToCustomer(customerId, consultantId);
  revalidatePath(ROUTES.customers);
  revalidatePath(customerHref(customerId));
  revalidatePath(ROUTES.people);
  revalidatePath(personHref(`consultant-${consultantId}`));
}

export async function removeConsultantFromCustomer(
  customerId: string,
  consultantId: string
) {
  await assertNotSubcontractorForWrite();
  await q.removeConsultantFromCustomer(customerId, consultantId);
  revalidatePath(ROUTES.customers);
  revalidatePath(customerHref(customerId));
  revalidatePath(ROUTES.people);
  revalidatePath(personHref(`consultant-${consultantId}`));
}
