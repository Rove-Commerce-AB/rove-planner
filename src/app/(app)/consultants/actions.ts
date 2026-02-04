"use server";

import { revalidatePath } from "next/cache";
import { createConsultant, type CreateConsultantInput } from "@/lib/consultants";

export async function createConsultantAndRevalidate(
  input: CreateConsultantInput
): Promise<{ id: string; name: string }> {
  const result = await createConsultant(input);
  revalidatePath("/consultants");
  revalidatePath("/allocation");
  return result;
}
