import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { todoDueDateToInputValue } from "@/lib/taskBoardDueDate";
import {
  getBoardForMember,
  listMembersForBoard,
  listTodosForMember,
} from "@/lib/taskBoardQueries";
import { TaskboardDetailPageClient } from "./TaskboardDetailPageClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ boardId: string }>;
};

export default async function TaskboardBoardPage({ params }: Props) {
  await redirectSubcontractorToAccessDenied();

  const session = await auth();
  const appUserId = session?.user?.appUserId;
  if (!appUserId) {
    redirect("/login");
  }

  const { boardId } = await params;
  const board = await getBoardForMember(boardId, appUserId);
  if (!board) {
    notFound();
  }

  const [todos, members] = await Promise.all([
    listTodosForMember(boardId, appUserId),
    listMembersForBoard(boardId, appUserId),
  ]);

  const isCreator = board.created_by_app_user_id === appUserId;

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-[min(100vw-3rem,80rem)]">
        <TaskboardDetailPageClient
          boardId={boardId}
          initialTitle={board.title}
          createdByAppUserId={board.created_by_app_user_id}
          isCreator={isCreator}
          todos={todos.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assigned_to_app_user_id: t.assigned_to_app_user_id,
            assignee_label:
              (t.assignee_name && t.assignee_name.trim()) ||
              (t.assignee_email && t.assignee_email.trim()) ||
              null,
            due_date: todoDueDateToInputValue(t.due_date),
          }))}
          members={members.map((m) => ({
            app_user_id: m.app_user_id,
            email: m.email,
            name: m.name,
          }))}
        />
      </div>
    </div>
  );
}
