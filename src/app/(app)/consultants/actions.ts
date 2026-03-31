"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createConsultant,
  getConsultantsList,
  linkNewInternalConsultantToRoveCustomer,
  type CreateConsultantInput,
} from "@/lib/consultants";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";

export async function createConsultantAndRevalidate(
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  await assertNotSubcontractorForWrite();
  const result = await createConsultant(input);

  const roveCustomerId = await linkNewInternalConsultantToRoveCustomer(
    result.id,
    input
  );
  if (roveCustomerId) {
    revalidatePath("/customers");
    revalidatePath(`/customers/${roveCustomerId}`);
  }

  revalidateTag("allocation-consultants", "max");
  revalidatePath("/consultants");
  revalidatePath("/allocation");
  return result;
}

/** For side panel list; call from client. */
export async function getConsultantsListAction() {
  return getConsultantsList();
}
