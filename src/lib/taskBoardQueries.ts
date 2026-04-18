import "server-only";

import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type TaskBoardSummary = {
  id: string;
  title: string;
  created_by_app_user_id: string;
  creator_email: string | null;
  creator_name: string | null;
  created_at: Date;
  updated_at: Date;
};

export type TaskBoardDetail = {
  id: string;
  title: string;
  created_by_app_user_id: string;
  created_at: Date;
  updated_at: Date;
};

export type TaskBoardTodoRow = {
  id: string;
  board_id: string;
  title: string;
  status: "todo" | "done";
  sort_order: number;
  assigned_to_app_user_id: string | null;
  assignee_email: string | null;
  assignee_name: string | null;
  /** `YYYY-MM-DD` from `to_char` — avoids JS `Date` timezone shifts for calendar dates. */
  due_date: string | null;
};

export type TaskBoardMemberRow = {
  app_user_id: string;
  email: string;
  name: string | null;
  created_at: Date;
};

export type AppUserSearchRow = {
  id: string;
  email: string;
  name: string | null;
};

export async function listBoardsForMember(
  appUserId: string
): Promise<TaskBoardSummary[]> {
  const { rows } = await cloudSqlPool.query<TaskBoardSummary>(
    `SELECT b.id, b.title, b.created_by_app_user_id, b.created_at, b.updated_at,
            au.email AS creator_email, au.name AS creator_name
     FROM task_boards b
     INNER JOIN task_board_members m ON m.board_id = b.id AND m.app_user_id = $1
     LEFT JOIN app_users au ON au.id = b.created_by_app_user_id
     ORDER BY b.updated_at DESC`,
    [appUserId]
  );
  return rows;
}

export async function createBoardWithCreatorMember(
  appUserId: string,
  title: string
): Promise<string> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Title is required");
  }

  const client = await cloudSqlPool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO task_boards (title, created_by_app_user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [trimmed, appUserId]
    );
    const boardId = rows[0]?.id;
    if (!boardId) {
      throw new Error("Could not create board");
    }
    await client.query(
      `INSERT INTO task_board_members (board_id, app_user_id) VALUES ($1, $2)`,
      [boardId, appUserId]
    );
    await client.query("COMMIT");
    return boardId;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateBoardTitleAsMember(
  boardId: string,
  appUserId: string,
  title: string
): Promise<boolean> {
  const trimmed = title.trim();
  if (!trimmed) {
    return false;
  }
  const { rowCount } = await cloudSqlPool.query(
    `UPDATE task_boards b
     SET title = $1, updated_at = now()
     WHERE b.id = $2
       AND EXISTS (
         SELECT 1 FROM task_board_members m
         WHERE m.board_id = b.id AND m.app_user_id = $3
       )`,
    [trimmed, boardId, appUserId]
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteBoardAsCreator(
  boardId: string,
  appUserId: string
): Promise<boolean> {
  const { rowCount } = await cloudSqlPool.query(
    `DELETE FROM task_boards
     WHERE id = $1 AND created_by_app_user_id = $2`,
    [boardId, appUserId]
  );
  return (rowCount ?? 0) > 0;
}

export async function getBoardForMember(
  boardId: string,
  appUserId: string
): Promise<TaskBoardDetail | null> {
  const { rows } = await cloudSqlPool.query<TaskBoardDetail>(
    `SELECT b.id, b.title, b.created_by_app_user_id, b.created_at, b.updated_at
     FROM task_boards b
     INNER JOIN task_board_members m ON m.board_id = b.id AND m.app_user_id = $2
     WHERE b.id = $1`,
    [boardId, appUserId]
  );
  return rows[0] ?? null;
}

export type TaskBoardMyTaskRow = {
  todo_id: string;
  board_id: string;
  todo_title: string;
  board_title: string;
};

/** Open todos assigned to this user on boards where they are a member. */
export async function listOpenTodosAssignedToUser(
  appUserId: string
): Promise<TaskBoardMyTaskRow[]> {
  const { rows } = await cloudSqlPool.query<TaskBoardMyTaskRow>(
    `SELECT t.id AS todo_id, t.board_id, t.title AS todo_title, b.title AS board_title
     FROM task_board_todos t
     INNER JOIN task_boards b ON b.id = t.board_id
     INNER JOIN task_board_members m ON m.board_id = t.board_id AND m.app_user_id = $1
     WHERE t.assigned_to_app_user_id = $1
       AND t.status = 'todo'
     ORDER BY b.updated_at DESC, t.sort_order ASC
     LIMIT 50`,
    [appUserId]
  );
  return rows;
}

export async function listTodosForMember(
  boardId: string,
  appUserId: string
): Promise<TaskBoardTodoRow[]> {
  const { rows } = await cloudSqlPool.query<TaskBoardTodoRow>(
    `SELECT t.id, t.board_id, t.title, t.status, t.sort_order,
            t.assigned_to_app_user_id,
            au.email AS assignee_email,
            au.name AS assignee_name,
            to_char(t.due_date, 'YYYY-MM-DD') AS due_date
     FROM task_board_todos t
     LEFT JOIN app_users au ON au.id = t.assigned_to_app_user_id
     WHERE t.board_id = $1
       AND EXISTS (
         SELECT 1 FROM task_board_members m
         WHERE m.board_id = t.board_id AND m.app_user_id = $2
       )
     ORDER BY CASE WHEN t.status = 'done' THEN 1 ELSE 0 END, t.sort_order ASC`,
    [boardId, appUserId]
  );
  return rows;
}

export async function getTodoTitleForMember(
  boardId: string,
  todoId: string,
  appUserId: string
): Promise<string | null> {
  const { rows } = await cloudSqlPool.query<{ title: string }>(
    `SELECT t.title
     FROM task_board_todos t
     WHERE t.id = $1 AND t.board_id = $2
       AND EXISTS (
         SELECT 1 FROM task_board_members m
         WHERE m.board_id = t.board_id AND m.app_user_id = $3
       )`,
    [todoId, boardId, appUserId]
  );
  return rows[0]?.title ?? null;
}

export async function updateTodoAssigneeForMember(
  boardId: string,
  todoId: string,
  actingAppUserId: string,
  assigneeAppUserId: string | null
): Promise<boolean> {
  if (assigneeAppUserId === null) {
    const { rowCount } = await cloudSqlPool.query(
      `UPDATE task_board_todos t
       SET assigned_to_app_user_id = NULL
       WHERE t.id = $1 AND t.board_id = $2
         AND EXISTS (
           SELECT 1 FROM task_board_members m
           WHERE m.board_id = t.board_id AND m.app_user_id = $3
         )`,
      [todoId, boardId, actingAppUserId]
    );
    return (rowCount ?? 0) > 0;
  }

  const { rowCount } = await cloudSqlPool.query(
    `UPDATE task_board_todos t
     SET assigned_to_app_user_id = $4
     WHERE t.id = $1 AND t.board_id = $2
       AND EXISTS (
         SELECT 1 FROM task_board_members m
         WHERE m.board_id = t.board_id AND m.app_user_id = $3
       )
       AND EXISTS (
         SELECT 1 FROM task_board_members m2
         WHERE m2.board_id = t.board_id AND m2.app_user_id = $4
       )`,
    [todoId, boardId, actingAppUserId, assigneeAppUserId]
  );
  return (rowCount ?? 0) > 0;
}

/** YYYY-MM-DD or null/empty to omit. */
function normalizeOptionalIsoDate(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function createTodoForMember(
  boardId: string,
  appUserId: string,
  title: string,
  dueDateIso: string | null | undefined = undefined
): Promise<string | null> {
  const trimmed = title.trim();
  if (!trimmed) {
    return null;
  }
  const due = normalizeOptionalIsoDate(dueDateIso ?? null);

  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `INSERT INTO task_board_todos (board_id, title, status, sort_order, due_date)
     SELECT $1, $2, 'todo',
            COALESCE(
              (SELECT MAX(t2.sort_order)
               FROM task_board_todos t2
               WHERE t2.board_id = $1 AND t2.status = 'todo'),
              -1
            ) + 1,
            $4::date
     WHERE EXISTS (
       SELECT 1 FROM task_board_members m
       WHERE m.board_id = $1 AND m.app_user_id = $3
     )
     RETURNING id`,
    [boardId, trimmed, appUserId, due]
  );
  return rows[0]?.id ?? null;
}

export async function updateTodoDueDateForMember(
  boardId: string,
  todoId: string,
  actingAppUserId: string,
  dueDateIso: string | null
): Promise<boolean> {
  const due = normalizeOptionalIsoDate(dueDateIso ?? null);
  const { rowCount } = await cloudSqlPool.query(
    `UPDATE task_board_todos t
     SET due_date = $4::date
     WHERE t.id = $1 AND t.board_id = $2
       AND EXISTS (
         SELECT 1 FROM task_board_members m
         WHERE m.board_id = t.board_id AND m.app_user_id = $3
       )`,
    [todoId, boardId, actingAppUserId, due]
  );
  return (rowCount ?? 0) > 0;
}

export async function setTodoDoneState(
  todoId: string,
  boardId: string,
  appUserId: string,
  wantDone: boolean
): Promise<boolean> {
  const client = await cloudSqlPool.connect();
  try {
    await client.query("BEGIN");
    const { rows: curRows } = await client.query<{ status: string }>(
      `SELECT t.status
       FROM task_board_todos t
       WHERE t.id = $1 AND t.board_id = $2
         AND EXISTS (
           SELECT 1 FROM task_board_members m
           WHERE m.board_id = t.board_id AND m.app_user_id = $3
         )
       FOR UPDATE`,
      [todoId, boardId, appUserId]
    );
    if (!curRows.length) {
      await client.query("ROLLBACK");
      return false;
    }
    const nextStatus = wantDone ? "done" : "todo";
    if (curRows[0].status === nextStatus) {
      await client.query("COMMIT");
      return true;
    }

    let sortOrder: number;
    if (nextStatus === "done") {
      const { rows: mx } = await client.query<{ m: string }>(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 AS m
         FROM task_board_todos WHERE board_id = $1`,
        [boardId]
      );
      sortOrder = Number(mx[0]?.m ?? 1);
    } else {
      const { rows: mx } = await client.query<{ m: string }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS m
         FROM task_board_todos
         WHERE board_id = $1 AND status = 'todo'`,
        [boardId]
      );
      sortOrder = Number(mx[0]?.m ?? 0);
    }

    await client.query(
      `UPDATE task_board_todos
       SET status = $1, sort_order = $2
       WHERE id = $3 AND board_id = $4`,
      [nextStatus, sortOrder, todoId, boardId]
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function listMembersForBoard(
  boardId: string,
  appUserId: string
): Promise<TaskBoardMemberRow[]> {
  const { rows } = await cloudSqlPool.query<TaskBoardMemberRow>(
    `SELECT m.app_user_id, u.email, u.name, m.created_at
     FROM task_board_members m
     INNER JOIN app_users u ON u.id = m.app_user_id
     WHERE m.board_id = $1
       AND EXISTS (
         SELECT 1 FROM task_board_members me
         WHERE me.board_id = $1 AND me.app_user_id = $2
       )
     ORDER BY lower(u.email)`,
    [boardId, appUserId]
  );
  return rows;
}

export async function addMemberAsCreator(
  boardId: string,
  creatorAppUserId: string,
  newMemberAppUserId: string
): Promise<boolean> {
  const { rows } = await cloudSqlPool.query<{ board_id: string }>(
    `INSERT INTO task_board_members (board_id, app_user_id)
     SELECT $1, $3
     FROM task_boards b
     WHERE b.id = $1 AND b.created_by_app_user_id = $2
     ON CONFLICT (board_id, app_user_id) DO NOTHING
     RETURNING board_id`,
    [boardId, creatorAppUserId, newMemberAppUserId]
  );
  return rows.length > 0;
}

export async function removeMemberAsCreator(
  boardId: string,
  creatorAppUserId: string,
  removeAppUserId: string
): Promise<boolean> {
  const client = await cloudSqlPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE task_board_todos
       SET assigned_to_app_user_id = NULL
       WHERE board_id = $1 AND assigned_to_app_user_id = $2`,
      [boardId, removeAppUserId]
    );
    const { rowCount } = await client.query(
      `DELETE FROM task_board_members m
       USING task_boards b
       WHERE m.board_id = $1
         AND m.board_id = b.id
         AND b.created_by_app_user_id = $2
         AND m.app_user_id = $3
         AND m.app_user_id <> b.created_by_app_user_id`,
      [boardId, creatorAppUserId, removeAppUserId]
    );
    await client.query("COMMIT");
    return (rowCount ?? 0) > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function searchAppUsersForBoardInvite(
  boardId: string,
  creatorAppUserId: string,
  rawQuery: string
): Promise<AppUserSearchRow[]> {
  const q = rawQuery.trim().toLowerCase();
  if (q.length < 1) {
    return [];
  }
  const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const { rows } = await cloudSqlPool.query<AppUserSearchRow>(
    `SELECT u.id, u.email, u.name
     FROM app_users u
     WHERE EXISTS (
             SELECT 1 FROM task_boards b
             WHERE b.id = $1 AND b.created_by_app_user_id = $2
           )
       AND NOT EXISTS (
             SELECT 1 FROM task_board_members m
             WHERE m.board_id = $1 AND m.app_user_id = u.id
           )
       AND (
             lower(u.email) LIKE $3 ESCAPE '\\'
          OR lower(COALESCE(u.name, '')) LIKE $3 ESCAPE '\\'
           )
     ORDER BY lower(u.email)
     LIMIT 20`,
    [boardId, creatorAppUserId, like]
  );
  return rows;
}
