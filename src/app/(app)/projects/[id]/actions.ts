"use server";

import { revalidatePath } from "next/cache";
import { moveAllocationsForProject } from "@/lib/allocations";

export async function moveEntireBookingAction(
  projectId: string,
  deltaWeeks: number
): Promise<{ ok: boolean; error?: string; moved?: number }> {
  try {
    const { moved } = await moveAllocationsForProject(projectId, deltaWeeks);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/allocation");
    revalidatePath("/reports");
    return { ok: true, moved };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to move bookings",
    };
  }
}
