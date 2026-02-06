"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createConsultant, type CreateConsultantInput } from "@/lib/consultants";

export async function createConsultantAndRevalidate(
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  const result = await createConsultant(input);
  revalidateTag("allocation-consultants", "max");
  revalidatePath("/consultants");
  revalidatePath("/allocation");
  return result;
}
