import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerById } from "@/lib/customers";
import { CustomerDetailClient } from "@/components/CustomerDetailClient";
import { Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);

  if (!customer) notFound();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="secondary" asChild>
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Link>
        </Button>
      </div>

      <CustomerDetailClient customer={customer} />
    </div>
  );
}
