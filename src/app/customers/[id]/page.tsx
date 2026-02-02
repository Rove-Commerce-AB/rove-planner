import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers";
import { CustomerDetailClient } from "@/components/CustomerDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) notFound();

  return (
    <div className="p-6">
      <CustomerDetailClient customer={customer} />
    </div>
  );
}
