"use server";

import { revalidatePath } from "next/cache";
import { deleteProject } from "@/lib/projects";
import { assertAdmin } from "@/lib/accessGuards";

export async function revalidateProjects() {
  revalidatePath("/projects");
}

export async function deleteProjectAction(
  id: string,
  customerId: string | null
): Promise<void> {
  await assertAdmin();
  await deleteProject(id);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  if (customerId) {
    revalidatePath(`/customers/${customerId}`);
  }
  revalidatePath("/allocation");
  revalidatePath("/reports");
}
