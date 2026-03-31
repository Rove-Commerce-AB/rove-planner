import "server-only";

import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/appUsers";

export async function redirectSubcontractorToAccessDenied() {
  const user = await getCurrentAppUser();
  if (user?.role === "subcontractor") {
    redirect("/access-denied");
  }
}

export async function assertNotSubcontractorForWrite() {
  const user = await getCurrentAppUser();
  if (!user || user.role === "subcontractor") {
    throw new Error("Unauthorized");
  }
}
