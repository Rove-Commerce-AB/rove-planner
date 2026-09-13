import { notFound, redirect } from "next/navigation";
import { workBoardHref } from "@/lib/routes";
import {
  getWorkBoardView,
  redirectIfLegacyWorkIssueUrl,
} from "@/lib/workBoards";
import { WorkBoardPageClient } from "./WorkBoardPageClient";

export const dynamic = "force-dynamic";

export default async function WorkBoardLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ customerId: string; boardId: string }>;
}) {
  const { customerId, boardId } = await params;
  const board = await getWorkBoardView(boardId);
  if (board) {
    if (board.customerId !== customerId) {
      redirect(workBoardHref(board.customerId, board.id));
    }
    return <WorkBoardPageClient board={board} />;
  }
  await redirectIfLegacyWorkIssueUrl(customerId, boardId);
  notFound();
}
