import { redirect } from "next/navigation";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

/**
 * Customer list is now in the side panel (click Customers in the sidebar).
 * Redirect so old bookmarks to /customers still work.
 */
export default async function CustomersPage() {
  await redirectSubcontractorToAccessDenied();
  redirect("/");
}
