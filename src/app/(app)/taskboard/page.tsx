import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { listBoardsForMember } from "@/lib/taskBoardQueries";
import { TaskboardListPageClient, type TaskboardListBoard } from "./TaskboardListPageClient";

export const dynamic = "force-dynamic";

export default async function TaskboardPage() {
  await redirectSubcontractorToAccessDenied();

  const session = await auth();
  const appUserId = session?.user?.appUserId;
  if (!appUserId) {
    redirect("/login");
  }

  const rows = await listBoardsForMember(appUserId);
  const boards: TaskboardListBoard[] = rows.map((b) => ({
    id: b.id,
    title: b.title,
    created_by_app_user_id: b.created_by_app_user_id,
    creator_label:
      (b.creator_name && b.creator_name.trim()) || b.creator_email || "Unknown",
    created_at: b.created_at.toISOString(),
    updated_at: b.updated_at.toISOString(),
    members: b.members.map((m) => ({
      app_user_id: m.app_user_id,
      email: m.email,
      name: m.name,
    })),
  }));

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-[min(100vw-3rem,72rem)]">
        <PageHeader title="Taskboard" className="mb-6" />
        <TaskboardListPageClient boards={boards} />
      </div>
    </div>
  );
}
