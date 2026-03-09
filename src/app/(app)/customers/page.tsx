import { redirect } from "next/navigation";

/**
 * Customer list is now in the side panel (click Customers in the sidebar).
 * Redirect so old bookmarks to /customers still work.
 */
export default function CustomersPage() {
  redirect("/");
}
