"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createConsultant,
  getConsultantsList,
  type CreateConsultantInput,
} from "@/lib/consultants";
import { getCustomerIdByName } from "@/lib/customers";
import { addConsultantToCustomer } from "@/lib/customerConsultants";

const ROVE_CUSTOMER_NAME = "Rove";

export async function createConsultantAndRevalidate(
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  const result = await createConsultant(input);

  const isInternal = !(input.is_external ?? false);
  if (isInternal) {
    const roveCustomerId = await getCustomerIdByName(ROVE_CUSTOMER_NAME);
    if (roveCustomerId) {
      await addConsultantToCustomer(roveCustomerId, result.id);
      revalidatePath("/customers");
      revalidatePath(`/customers/${roveCustomerId}`);
    }
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
