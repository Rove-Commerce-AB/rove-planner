"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createConsultant,
  deleteConsultant,
  linkNewInternalConsultantToInternalCustomer,
  type CreateConsultantInput,
} from "@/lib/consultants";
import { assertAdmin, assertNotSubcontractorForWrite } from "@/lib/accessGuards";
import { ROUTES, customerHref, consultantHref } from "@/lib/routes";

export async function createConsultantAndRevalidate(
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  await assertNotSubcontractorForWrite();
  const result = await createConsultant(input);

  const internalCustomerId = await linkNewInternalConsultantToInternalCustomer(
    result.id,
    input
  );
  if (internalCustomerId) {
    revalidatePath(ROUTES.customers);
    revalidatePath(customerHref(internalCustomerId));
  }

  revalidateTag("allocation-consultants", "max");
  revalidatePath(ROUTES.consultants);
  revalidatePath(ROUTES.people);
  revalidatePath(consultantHref(result.id));
  revalidatePath(ROUTES.planner, "layout");
  return result;
}

export async function deleteConsultantAction(id: string): Promise<void> {
  await assertAdmin();
  await deleteConsultant(id);
  revalidateTag("allocation-consultants", "max");
  revalidatePath(ROUTES.consultants);
  revalidatePath(ROUTES.people);
  revalidatePath(ROUTES.planner, "layout");
}
