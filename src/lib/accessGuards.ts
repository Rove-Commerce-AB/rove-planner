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

export async function assertAdmin() {
  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

/**
 * Data agenten kan svara på frågor över hela verksamheten (alla kunder,
 * alla konsulter, alla allokeringar) — inte scopead per användare som de
 * flesta read-vyerna. Default: alla roller utom subcontractor. Byt till
 * samma mönster som assertAdmin() om ni vill börja snävare (bara admins).
 */
export async function assertCanUseDataAgent() {
  const user = await getCurrentAppUser();
  if (!user || user.role === "subcontractor") {
    throw new Error("Unauthorized");
  }
}
