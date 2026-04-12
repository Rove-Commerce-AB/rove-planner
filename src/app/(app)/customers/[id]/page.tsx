import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers";
import { getConsultantsByCustomerId } from "@/lib/customerConsultants";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import { CustomerDetailClient } from "@/components/CustomerDetailClient";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { getCurrentAppUser } from "@/lib/appUsers";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: Props) {
  await redirectSubcontractorToAccessDenied();

  const { id } = await params;
  const [customer, consultants, allConsultants, appUser] = await Promise.all([
    getCustomerById(id),
    getConsultantsByCustomerId(id),
    getConsultantsWithDefaultRole(),
    getCurrentAppUser(),
  ]);
  const isAdmin = appUser?.role === "admin";

  if (!customer) notFound();

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-3xl">
        <CustomerDetailClient
          customer={customer}
          initialConsultants={consultants}
          allConsultants={allConsultants.map((c) => ({ id: c.id, name: c.name }))}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
