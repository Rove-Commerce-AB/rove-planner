import { notFound, redirect } from "next/navigation";
import { workProjectHref } from "@/lib/routes";
import {
  getWorkBoardView,
  getWorkProjectPreferredView,
  redirectIfLegacyWorkIssueUrl,
} from "@/lib/workBoards";
import { WorkProjectPageClient } from "./WorkProjectPageClient";

export const dynamic = "force-dynamic";

export default async function WorkProjectLayout({
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ customerId: string; projectId: string }>;
}) {
  const { customerId, projectId } = await params;
  const board = await getWorkBoardView(projectId);
  if (board) {
    if (board.customerId !== customerId) {
      redirect(workProjectHref(board.customerId, board.id));
    }
    const preferredView = await getWorkProjectPreferredView(projectId);
    return (
      <WorkProjectPageClient
        board={board}
        initialView={preferredView ?? "board"}
      />
    );
  }
  await redirectIfLegacyWorkIssueUrl(customerId, projectId);
  notFound();
}
