import { redirect } from "next/navigation";

/** Consultants are listed in the side panel; no standalone list page. */
export default function ConsultantsPage() {
  redirect("/");
}
