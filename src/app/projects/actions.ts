"use server";

import { revalidatePath } from "next/cache";

export async function revalidateProjects() {
  revalidatePath("/projects");
}
