import { redirect } from "next/navigation";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

/** Consultants are listed in the side panel; no standalone list page. */
export default async function ConsultantsPage() {
  await redirectSubcontractorToAccessDenied();
  redirect("/");
}
