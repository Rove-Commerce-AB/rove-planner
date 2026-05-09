"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createConsultant,
  deleteConsultant,
  getConsultantsList,
  linkNewInternalConsultantToInternalCustomer,
  type CreateConsultantInput,
} from "@/lib/consultants";
import { assertAdmin, assertNotSubcontractorForWrite } from "@/lib/accessGuards";

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
    revalidatePath("/customers");
    revalidatePath(`/customers/${internalCustomerId}`);
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

export async function deleteConsultantAction(id: string): Promise<void> {
  await assertAdmin();
  await deleteConsultant(id);
  revalidateTag("allocation-consultants", "max");
  revalidatePath("/consultants");
  revalidatePath("/allocation");
}
