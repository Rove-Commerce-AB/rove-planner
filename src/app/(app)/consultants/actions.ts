"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createConsultant,
  getConsultantsList,
  type CreateConsultantInput,
} from "@/lib/consultants";

export async function createConsultantAndRevalidate(
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  const result = await createConsultant(input);
  revalidateTag("allocation-consultants");
  revalidatePath("/consultants");
  revalidatePath("/allocation");
  return result;
}

/** For side panel list; call from client. */
export async function getConsultantsListAction() {
  return getConsultantsList();
}
