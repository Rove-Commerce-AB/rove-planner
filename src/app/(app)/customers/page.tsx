import { getCustomersWithDetails } from "@/lib/customers";
import { CustomersPageClient } from "@/components/CustomersPageClient";

export default async function CustomersPage() {
  let customers: Awaited<ReturnType<typeof getCustomersWithDetails>> = [];
  let error: string | null = null;

  try {
    customers = await getCustomersWithDetails();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch customers";
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <CustomersPageClient customers={customers} error={error} />
      </div>
    </div>
  );
}
