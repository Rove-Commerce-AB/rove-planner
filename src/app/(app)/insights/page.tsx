import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { DataAgentChat } from "@/components/DataAgentChat";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  await redirectSubcontractorToAccessDenied();

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col p-6">
      <h1 className="mb-4 text-lg font-semibold text-text-primary">
        Ask the data
      </h1>
      <DataAgentChat />
    </div>
  );
}
