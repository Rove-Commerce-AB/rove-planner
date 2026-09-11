import { getCurrentAppUser } from "@/lib/appUsers";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import {
  getConsultantsByCustomerIds,
  type CustomerConsultantsByCustomerId,
} from "@/lib/customerConsultants";
import {
  getCustomerUsers,
  getCustomerUsersByCustomerIds,
  type CustomerAppUser,
  type CustomerAppUsersByCustomerId,
} from "@/lib/customerAppUsers";
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
  let usersByCustomer: CustomerAppUsersByCustomerId = {};
  let allConsultants: { id: string; name: string }[] = [];
  let allCustomerUsers: CustomerAppUser[] = [];
  let error: string | null = null;

  try {
    customers = await getCustomersWithDetails();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load customers";
  }

  if (!error) {
    const [customerConsultantsResult, consultantsResult, usersResult, allUsersResult] =
      await Promise.allSettled([
        getConsultantsByCustomerIds(customers.map((customer) => customer.id)),
        getConsultantsWithDefaultRole(),
        getCustomerUsersByCustomerIds(customers.map((customer) => customer.id)),
        getCustomerUsers(),
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
    if (usersResult.status === "fulfilled") {
      usersByCustomer = usersResult.value;
    }
    if (allUsersResult.status === "fulfilled") {
      allCustomerUsers = allUsersResult.value;
    }
  }

  return (
    <>
      <CustomersPageClient
        customers={customers}
        consultantsByCustomer={consultantsByCustomer}
        usersByCustomer={usersByCustomer}
        allConsultants={allConsultants}
        allCustomerUsers={allCustomerUsers}
        error={error}
        isAdmin={user?.role === "admin"}
      />
      <div hidden>{children}</div>
    </>
  );
}
