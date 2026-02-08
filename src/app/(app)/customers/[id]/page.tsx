import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers";
import { getConsultantsByCustomerId } from "@/lib/customerConsultants";
import { getConsultantsWithDefaultRole } from "@/lib/consultants";
import { CustomerDetailClient } from "@/components/CustomerDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: Props) {
  const { id } = await params;
  const [customer, consultants, allConsultants] = await Promise.all([
    getCustomerById(id),
    getConsultantsByCustomerId(id),
    getConsultantsWithDefaultRole(),
  ]);

  if (!customer) notFound();

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <CustomerDetailClient
          customer={customer}
          initialConsultants={consultants}
          allConsultants={allConsultants.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
