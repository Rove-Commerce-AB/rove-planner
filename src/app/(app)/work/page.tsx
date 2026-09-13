import { listWorkSelectorCustomers } from "@/lib/workBoards";
import { WorkSelectorPageClient } from "./WorkSelectorPageClient";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const customers = await listWorkSelectorCustomers();

  return <WorkSelectorPageClient customers={customers} />;
}
