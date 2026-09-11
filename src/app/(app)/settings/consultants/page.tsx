export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function ConsultantsPage() {
  redirect(ROUTES.people);
}
