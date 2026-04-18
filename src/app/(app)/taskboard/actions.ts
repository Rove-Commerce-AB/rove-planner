"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { assertNotSubcontractorForWrite } from "@/lib/accessGuards";
import { USER_NOTIFICATION_KIND } from "@/lib/userNotificationKinds";
import { insertUserNotification } from "@/lib/userNotifications";
import {
  addMemberAsCreator,
  createBoardWithCreatorMember,
  createTodoForMember,
  deleteBoardAsCreator,
  getBoardForMember,
  getTodoTitleForMember,
  removeMemberAsCreator,
  searchAppUsersForBoardInvite,
  setTodoDoneState,
  updateBoardTitleAsMember,
  updateTodoAssigneeForMember,
  updateTodoDueDateForMember,
} from "@/lib/taskBoardQueries";

async function requireAppUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.appUserId;
  if (!id) {
    throw new Error("Unauthorized");
  }
  return id;
}

type OkErr = { ok: true } | { ok: false; error: string };

export async function createBoardAction(title: string): Promise<
  | { ok: true; boardId: string }
  | { ok: false; error: string }
> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const boardId = await createBoardWithCreatorMember(appUserId, title);
    revalidatePath("/taskboard");
    return { ok: true, boardId };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create board.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to create boards." };
    }
    return { ok: false, error: message };
  }
}

export async function updateBoardTitleAction(
  boardId: string,
  title: string
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await updateBoardTitleAsMember(boardId, appUserId, title);
    if (!ok) {
      return { ok: false, error: "Board not found or no access." };
    }
    revalidatePath("/taskboard");
    revalidatePath(`/taskboard/${boardId}`);
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not update board.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to update this board." };
    }
    return { ok: false, error: message };
  }
}

export async function deleteBoardAction(boardId: string): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await deleteBoardAsCreator(boardId, appUserId);
    if (!ok) {
      return {
        ok: false,
        error: "Only the board owner can delete it, or the board no longer exists.",
      };
    }
    revalidatePath("/taskboard");
    revalidatePath("/", "page");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not delete board.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to delete boards." };
    }
    return { ok: false, error: message };
  }
}

export async function createTodoAction(
  boardId: string,
  title: string,
  dueDateIso?: string | null
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const id = await createTodoForMember(
      boardId,
      appUserId,
      title,
      dueDateIso ?? null
    );
    if (!id) {
      return { ok: false, error: "Board not found or no access." };
    }
    revalidatePath(`/taskboard/${boardId}`);
    if (dueDateIso != null && String(dueDateIso).trim() !== "") {
      revalidatePath("/", "page");
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not add todo.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to add todos." };
    }
    return { ok: false, error: message };
  }
}

export async function setTodoDueDateAction(
  boardId: string,
  todoId: string,
  dueDateIso: string | null
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await updateTodoDueDateForMember(
      boardId,
      todoId,
      appUserId,
      dueDateIso
    );
    if (!ok) {
      return { ok: false, error: "Todo not found or no access." };
    }
    revalidatePath(`/taskboard/${boardId}`);
    revalidatePath("/", "page");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not update due date.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to update todos." };
    }
    return { ok: false, error: message };
  }
}

export async function setTodoDoneAction(
  boardId: string,
  todoId: string,
  done: boolean
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await setTodoDoneState(todoId, boardId, appUserId, done);
    if (!ok) {
      return { ok: false, error: "Todo not found or no access." };
    }
    revalidatePath(`/taskboard/${boardId}`);
    revalidatePath("/", "page");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not update todo.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to update todos." };
    }
    return { ok: false, error: message };
  }
}

export async function setTodoAssigneeAction(
  boardId: string,
  todoId: string,
  assigneeAppUserId: string | null
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await updateTodoAssigneeForMember(
      boardId,
      todoId,
      appUserId,
      assigneeAppUserId
    );
    if (!ok) {
      return {
        ok: false,
        error:
          "Could not update assignee (todo not found, no access, or assignee is not a board member).",
      };
    }

    if (
      assigneeAppUserId != null &&
      assigneeAppUserId !== appUserId
    ) {
      try {
        const [board, todoTitle] = await Promise.all([
          getBoardForMember(boardId, appUserId),
          getTodoTitleForMember(boardId, todoId, appUserId),
        ]);
        if (board && todoTitle) {
          const session = await auth();
          const assignerLabel =
            session?.user?.name?.trim() ||
            session?.user?.email?.trim() ||
            "Someone";
          await insertUserNotification(
            assigneeAppUserId,
            USER_NOTIFICATION_KIND.TASK_TODO_ASSIGNED,
            {
              boardId,
              boardTitle: board.title,
              todoId,
              todoTitle,
              assignerLabel,
            }
          );
        }
      } catch (e) {
        console.warn("[taskboard] todo assign notification failed", e);
      }
    }

    revalidatePath(`/taskboard/${boardId}`);
    revalidatePath("/", "page");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not update assignee.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to update todos." };
    }
    return { ok: false, error: message };
  }
}

export async function addBoardMemberAction(
  boardId: string,
  memberAppUserId: string
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await addMemberAsCreator(boardId, appUserId, memberAppUserId);
    if (!ok) {
      return {
        ok: false,
        error: "Could not add member (only the owner can invite, or user is already on the board).",
      };
    }

    try {
      const session = await auth();
      const inviterLabel =
        session?.user?.name?.trim() ||
        session?.user?.email?.trim() ||
        "Someone";
      const board = await getBoardForMember(boardId, appUserId);
      if (board) {
        await insertUserNotification(
          memberAppUserId,
          USER_NOTIFICATION_KIND.TASK_BOARD_INVITED,
          {
            boardId,
            boardTitle: board.title,
            inviterLabel,
          }
        );
      }
    } catch (e) {
      console.warn("[taskboard] board invite notification failed", e);
    }

    revalidatePath(`/taskboard/${boardId}`);
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not add member.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to invite members." };
    }
    return { ok: false, error: message };
  }
}

export async function removeBoardMemberAction(
  boardId: string,
  memberAppUserId: string
): Promise<OkErr> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const ok = await removeMemberAsCreator(boardId, appUserId, memberAppUserId);
    if (!ok) {
      return {
        ok: false,
        error: "Could not remove member (only the owner can remove, and the owner cannot be removed).",
      };
    }
    revalidatePath(`/taskboard/${boardId}`);
    revalidatePath("/", "page");
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not remove member.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission to remove members." };
    }
    return { ok: false, error: message };
  }
}

export type BoardInviteUserRow = {
  id: string;
  email: string;
  name: string | null;
};

export async function searchBoardInviteUsersAction(
  boardId: string,
  query: string
): Promise<
  | { ok: true; users: BoardInviteUserRow[] }
  | { ok: false; error: string }
> {
  try {
    await assertNotSubcontractorForWrite();
    const appUserId = await requireAppUserId();
    const board = await getBoardForMember(boardId, appUserId);
    if (!board || board.created_by_app_user_id !== appUserId) {
      return { ok: false, error: "Only the board owner can search for users to invite." };
    }
    const users = await searchAppUsersForBoardInvite(boardId, appUserId, query);
    return { ok: true, users };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not search users.";
    if (message === "Unauthorized") {
      return { ok: false, error: "You do not have permission." };
    }
    return { ok: false, error: message };
  }
}
