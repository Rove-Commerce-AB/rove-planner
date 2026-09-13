import { notFound } from "next/navigation";
import {
  getWorkCustomerView,
  redirectIfLegacyWorkBoardUrl,
} from "@/lib/workBoards";
import { WorkCustomerPageClient } from "./WorkCustomerPageClient";

export const dynamic = "force-dynamic";

export default async function WorkCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = await getWorkCustomerView(customerId);
  if (customer) {
    return <WorkCustomerPageClient customer={customer} />;
  }
  await redirectIfLegacyWorkBoardUrl(customerId);
  notFound();
}
