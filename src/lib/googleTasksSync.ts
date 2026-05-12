import "server-only";

import {
  createGoogleTaskList,
  findGoogleTaskListByTitle,
  insertGoogleTask,
  listGoogleTasks,
  patchGoogleTask,
  refreshGoogleAccessToken,
  type GoogleTask,
} from "@/lib/googleTasksClient";
import {
  getGoogleTaskListMap,
  getGoogleTaskMapByRemote,
  getGoogleTaskMapByTodo,
  getGoogleUserConnection,
  listBoardMemberAppUserIdsWithGoogleConnection,
  setGoogleUserConnectionError,
  touchGoogleUserSyncAt,
  updateGoogleUserTokens,
  upsertGoogleTaskListMap,
  upsertGoogleTaskMap,
} from "@/lib/googleTasksSyncQueries";
import {
  getBoardForMember,
  getTodoForMember,
  listBoardsForMemberSimple,
  listTodosForMember,
  updateTodoFromGoogleSync,
  upsertTodoFromGoogleSync,
} from "@/lib/taskBoardQueries";

function toGoogleTaskDueDate(isoDate: string | null): string | undefined {
  if (!isoDate) return undefined;
  return `${isoDate}T00:00:00.000Z`;
}

function fromGoogleTaskDueDate(due: string | undefined): string | null {
  if (!due) return null;
  const normalized = String(due).trim();
  if (normalized.length < 10) return null;
  const iso = normalized.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function toGoogleTaskStatus(status: "todo" | "done"): "needsAction" | "completed" {
  return status === "done" ? "completed" : "needsAction";
}

function fromGoogleTaskStatus(status: string | undefined): "todo" | "done" {
  return status === "completed" ? "done" : "todo";
}

const GOOGLE_TASK_NOTES_MAX = 8000;

/** Plain-text “icon” for Google Tasks notes (no HTML/images supported there). */
const ASSIGNEE_NOTE_PREFIX = "\u{1F464} "; // 👤

function buildAssigneeGoogleNotes(todo: {
  assigned_to_app_user_id: string | null;
  assignee_email: string | null;
  assignee_name: string | null;
}): string {
  if (!todo.assigned_to_app_user_id) {
    return `${ASSIGNEE_NOTE_PREFIX}Assignee: (none)`.slice(0, GOOGLE_TASK_NOTES_MAX);
  }
  const name = todo.assignee_name?.trim() ?? "";
  const email = todo.assignee_email?.trim() ?? "";
  const primary =
    name || email || "Unknown";
  const suffix =
    email && email !== primary ? ` (${email})` : "";
  return `${ASSIGNEE_NOTE_PREFIX}Assignee: ${primary}${suffix}`.slice(
    0,
    GOOGLE_TASK_NOTES_MAX
  );
}

async function getValidAccessToken(appUserId: string): Promise<string | null> {
  const conn = await getGoogleUserConnection(appUserId);
  if (!conn?.access_token) return null;
  const expiresAt = conn.access_token_expires_at?.getTime() ?? 0;
  const nowWithSkew = Date.now() + 30_000;
  if (expiresAt > nowWithSkew) {
    return conn.access_token;
  }
  if (!conn.refresh_token) {
    return conn.access_token;
  }
  try {
    const refreshed = await refreshGoogleAccessToken({
      refreshToken: conn.refresh_token,
    });
    await updateGoogleUserTokens({
      appUserId,
      accessToken: refreshed.accessToken,
      tokenType: refreshed.tokenType,
      accessTokenExpiresAt: refreshed.expiresAt,
    });
    return refreshed.accessToken;
  } catch (e) {
    await setGoogleUserConnectionError(
      appUserId,
      e instanceof Error ? e.message : "Failed to refresh Google token."
    );
    return null;
  }
}

async function ensureGoogleTaskListForBoard(input: {
  appUserId: string;
  boardId: string;
  boardTitle: string;
  accessToken: string;
}): Promise<{ taskListId: string; taskListTitle: string | null } | null> {
  const existing = await getGoogleTaskListMap(input.appUserId, input.boardId);
  if (existing) {
    return {
      taskListId: existing.google_task_list_id,
      taskListTitle: existing.google_task_list_title,
    };
  }
  const found = await findGoogleTaskListByTitle(input.accessToken, input.boardTitle);
  const list = found ?? (await createGoogleTaskList(input.accessToken, input.boardTitle));
  await upsertGoogleTaskListMap({
    appUserId: input.appUserId,
    boardId: input.boardId,
    googleTaskListId: list.id,
    googleTaskListTitle: list.title ?? null,
  });
  return { taskListId: list.id, taskListTitle: list.title ?? null };
}

export async function syncTodoToGoogle(input: {
  /** Member performing the change (must be on the board); used to load board/todo. */
  actingAppUserId: string;
  boardId: string;
  todoId: string;
  /** If set, only push to these board members (must have Google connection). */
  targetMemberIds?: string[] | null;
}) {
  const [board, todo] = await Promise.all([
    getBoardForMember(input.boardId, input.actingAppUserId),
    getTodoForMember(input.boardId, input.todoId, input.actingAppUserId),
  ]);
  if (!board || !todo) return;

  const connectedMembers =
    await listBoardMemberAppUserIdsWithGoogleConnection(input.boardId);
  if (connectedMembers.length === 0) return;

  let targets =
    input.targetMemberIds != null && input.targetMemberIds.length > 0
      ? input.targetMemberIds.filter((id) => typeof id === "string" && id.trim() !== "")
      : connectedMembers;

  if (input.targetMemberIds != null && input.targetMemberIds.length > 0) {
    const allowed = new Set(connectedMembers);
    targets = targets.filter((id) => allowed.has(id));
  }

  const notes = buildAssigneeGoogleNotes(todo);
  const payloadBase = {
    title: todo.title,
    notes,
    due: toGoogleTaskDueDate(todo.due_date) ?? null,
    status: toGoogleTaskStatus(todo.status),
  };

  for (const targetAppUserId of targets) {
    try {
      const accessToken = await getValidAccessToken(targetAppUserId);
      if (!accessToken) continue;
      const list = await ensureGoogleTaskListForBoard({
        appUserId: targetAppUserId,
        boardId: input.boardId,
        boardTitle: board.title,
        accessToken,
      });
      if (!list) continue;
      const existingMap = await getGoogleTaskMapByTodo(
        targetAppUserId,
        input.todoId
      );
      const remoteTask = existingMap
        ? await patchGoogleTask(
            accessToken,
            list.taskListId,
            existingMap.google_task_id,
            payloadBase
          )
        : await insertGoogleTask(accessToken, list.taskListId, payloadBase);

      await upsertGoogleTaskMap({
        appUserId: targetAppUserId,
        boardId: input.boardId,
        todoId: input.todoId,
        googleTaskListId: list.taskListId,
        googleTaskId: remoteTask.id,
        sourceLastWrite: "taskboard",
        sourceLastModifiedAt: todo.updated_at,
      });
      await touchGoogleUserSyncAt(targetAppUserId);
    } catch (e) {
      console.warn("[taskboard] google tasks outbound sync member failed", {
        targetAppUserId,
        todoId: input.todoId,
        error: e,
      });
    }
  }
}

function pickMostRecentLocalOrRemote(input: {
  localUpdatedAt: Date;
  remoteUpdatedAt: Date | null;
}): "local" | "remote" {
  if (!input.remoteUpdatedAt) return "local";
  return input.remoteUpdatedAt.getTime() > input.localUpdatedAt.getTime()
    ? "remote"
    : "local";
}

function remoteTaskUpdatedAt(task: GoogleTask): Date | null {
  if (!task.updated) return null;
  const d = new Date(task.updated);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function syncBoardFromGoogle(input: {
  appUserId: string;
  boardId: string;
}) {
  const accessToken = await getValidAccessToken(input.appUserId);
  if (!accessToken) return;
  const board = await getBoardForMember(input.boardId, input.appUserId);
  if (!board) return;
  const list = await ensureGoogleTaskListForBoard({
    appUserId: input.appUserId,
    boardId: input.boardId,
    boardTitle: board.title,
    accessToken,
  });
  if (!list) return;

  const [remoteTasks, localTodos] = await Promise.all([
    listGoogleTasks(accessToken, list.taskListId),
    listTodosForMember(input.boardId, input.appUserId),
  ]);

  const localByTodoId = new Map(localTodos.map((t) => [t.id, t]));

  for (const remote of remoteTasks) {
    if (!remote.id) continue;
    if (!remote.title || !remote.title.trim()) continue;
    const map = await getGoogleTaskMapByRemote(
      input.appUserId,
      list.taskListId,
      remote.id
    );
    if (!map) {
      const createdId = await upsertTodoFromGoogleSync({
        boardId: input.boardId,
        appUserId: input.appUserId,
        title: remote.title,
        status: fromGoogleTaskStatus(remote.status),
        dueDateIso: fromGoogleTaskDueDate(remote.due),
        updatedAt: remoteTaskUpdatedAt(remote) ?? new Date(),
      });
      if (!createdId) continue;
      await upsertGoogleTaskMap({
        appUserId: input.appUserId,
        boardId: input.boardId,
        todoId: createdId,
        googleTaskListId: list.taskListId,
        googleTaskId: remote.id,
        sourceLastWrite: "google",
        sourceLastModifiedAt: remoteTaskUpdatedAt(remote) ?? new Date(),
      });
      continue;
    }

    const local = localByTodoId.get(map.todo_id);
    if (!local) continue;
    const decision = pickMostRecentLocalOrRemote({
      localUpdatedAt: local.updated_at,
      remoteUpdatedAt: remoteTaskUpdatedAt(remote),
    });
    if (decision === "remote") {
      await updateTodoFromGoogleSync({
        boardId: input.boardId,
        todoId: local.id,
        appUserId: input.appUserId,
        title: remote.title,
        status: fromGoogleTaskStatus(remote.status),
        dueDateIso: fromGoogleTaskDueDate(remote.due),
        updatedAt: remoteTaskUpdatedAt(remote) ?? new Date(),
      });
      await upsertGoogleTaskMap({
        appUserId: input.appUserId,
        boardId: input.boardId,
        todoId: local.id,
        googleTaskListId: list.taskListId,
        googleTaskId: remote.id,
        sourceLastWrite: "google",
        sourceLastModifiedAt: remoteTaskUpdatedAt(remote) ?? new Date(),
      });
      continue;
    }

    const patched = await patchGoogleTask(
      accessToken,
      list.taskListId,
      remote.id,
      {
        title: local.title,
        notes: buildAssigneeGoogleNotes(local),
        due: toGoogleTaskDueDate(local.due_date) ?? null,
        status: toGoogleTaskStatus(local.status),
      }
    );
    await upsertGoogleTaskMap({
      appUserId: input.appUserId,
      boardId: input.boardId,
      todoId: local.id,
      googleTaskListId: list.taskListId,
      googleTaskId: remote.id,
      sourceLastWrite: "taskboard",
      sourceLastModifiedAt: local.updated_at,
    });
    if (patched.id) {
      // no-op: ensures patch call was executed and typed use has side effects.
    }
  }
  await touchGoogleUserSyncAt(input.appUserId);
}

export async function syncAllBoardsFromGoogle(appUserId: string) {
  const boards = await listBoardsForMemberSimple(appUserId);
  for (const board of boards) {
    try {
      await syncBoardFromGoogle({ appUserId, boardId: board.id });
    } catch (e) {
      await setGoogleUserConnectionError(
        appUserId,
        e instanceof Error ? e.message : "Google sync failed."
      );
    }
  }
}
