import { listMyWorkIssues } from "@/lib/workMyIssues";
import { WorkMyIssuesPageClient } from "./WorkMyIssuesPageClient";

export const dynamic = "force-dynamic";

export default async function WorkMyIssuesPage() {
  const issues = await listMyWorkIssues();
  return <WorkMyIssuesPageClient issues={issues} />;
}
