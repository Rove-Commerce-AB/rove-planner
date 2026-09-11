import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  await redirectSubcontractorToAccessDenied();

  return (
    <div>
      <PageHeader title="Rove Work" description="Coming soon." />
    </div>
  );
}
