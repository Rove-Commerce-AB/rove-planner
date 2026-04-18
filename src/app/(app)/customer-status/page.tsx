import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { listActiveCustomersWithLatestStatus } from "@/lib/customerStatus";
import { PageHeader } from "@/components/ui";
import { CustomerStatusPageClient } from "./CustomerStatusPageClient";

export const dynamic = "force-dynamic";

export default async function CustomerStatusPage() {
  await redirectSubcontractorToAccessDenied();

  const customers = await listActiveCustomersWithLatestStatus();
  const initialRows = customers.map((c) => ({
    customerId: c.customerId,
    customerName: c.customerName,
    latest: c.latest
      ? {
          id: c.latest.id,
          traffic_light: c.latest.traffic_light,
          body: c.latest.body,
          year: c.latest.year,
          week: c.latest.week,
          created_at: c.latest.created_at.toISOString(),
        }
      : null,
  }));

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-[min(100vw-3rem,56rem)]">
        <PageHeader title="Customer status" className="mb-6" />
        <CustomerStatusPageClient initialRows={initialRows} />
      </div>
    </div>
  );
}
