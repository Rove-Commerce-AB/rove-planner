import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import {
  getConsultantsByCustomerIds,
  type CustomerConsultantsByCustomerId,
} from "@/lib/customerConsultants";
import { getCustomersWithDetails } from "@/lib/customers";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { CustomersPageClient } from "@/components/CustomersPageClient";

export const dynamic = "force-dynamic";

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectSubcontractorToAccessDenied();

  const user = await getCurrentAppUser();
  let customers: Awaited<ReturnType<typeof getCustomersWithDetails>> = [];
  let consultantsByCustomer: CustomerConsultantsByCustomerId = {};
  let allConsultants: { id: string; name: string }[] = [];
  let error: string | null = null;

  try {
    customers = await getCustomersWithDetails();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load customers";
  }

  if (!error) {
    const [customerConsultantsResult, consultantsResult] =
      await Promise.allSettled([
        getConsultantsByCustomerIds(customers.map((customer) => customer.id)),
        getConsultantsWithDefaultRole(),
      ]);

    if (customerConsultantsResult.status === "fulfilled") {
      consultantsByCustomer = customerConsultantsResult.value;
    }
    if (consultantsResult.status === "fulfilled") {
      allConsultants = consultantsResult.value.map((consultant) => ({
        id: consultant.id,
        name: consultant.name,
      }));
    }
  }

  return (
    <>
      <CustomersPageClient
        customers={customers}
        consultantsByCustomer={consultantsByCustomer}
        allConsultants={allConsultants}
        error={error}
        isAdmin={user?.role === "admin"}
      />
      <div hidden>{children}</div>
    </>
  );
}
