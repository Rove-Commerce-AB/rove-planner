import "server-only";

import { cloudSqlPool } from "@/lib/cloudSqlPool";

export type GoogleUserConnection = {
  app_user_id: string;
  google_sub: string;
  google_email: string | null;
  scope: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  access_token_expires_at: Date | null;
  last_sync_at: Date | null;
  last_error: string | null;
};

export type GoogleTaskListMap = {
  app_user_id: string;
  board_id: string;
  google_task_list_id: string;
  google_task_list_title: string | null;
};

export type GoogleTaskMapRow = {
  app_user_id: string;
  board_id: string;
  todo_id: string;
  google_task_list_id: string;
  google_task_id: string;
  source_last_write: "taskboard" | "google";
  source_last_modified_at: Date;
};

export async function upsertGoogleUserConnection(input: {
  appUserId: string;
  googleSub: string;
  googleEmail: string | null;
  scope: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  accessTokenExpiresAt: Date | null;
}) {
  await cloudSqlPool.query(
    `INSERT INTO google_user_connections (
       app_user_id, google_sub, google_email, scope,
       access_token, refresh_token, token_type, access_token_expires_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (app_user_id) DO UPDATE SET
       google_sub = EXCLUDED.google_sub,
       google_email = EXCLUDED.google_email,
       scope = EXCLUDED.scope,
       access_token = COALESCE(EXCLUDED.access_token, google_user_connections.access_token),
       refresh_token = COALESCE(EXCLUDED.refresh_token, google_user_connections.refresh_token),
       token_type = COALESCE(EXCLUDED.token_type, google_user_connections.token_type),
       access_token_expires_at = COALESCE(EXCLUDED.access_token_expires_at, google_user_connections.access_token_expires_at),
       updated_at = now()`,
    [
      input.appUserId,
      input.googleSub,
      input.googleEmail,
      input.scope,
      input.accessToken,
      input.refreshToken,
      input.tokenType,
      input.accessTokenExpiresAt,
    ]
  );
}

export async function getGoogleUserConnection(
  appUserId: string
): Promise<GoogleUserConnection | null> {
  const { rows } = await cloudSqlPool.query<GoogleUserConnection>(
    `SELECT app_user_id, google_sub, google_email, scope, access_token, refresh_token,
            token_type, access_token_expires_at, last_sync_at, last_error
     FROM google_user_connections
     WHERE app_user_id = $1`,
    [appUserId]
  );
  return rows[0] ?? null;
}

export async function updateGoogleUserTokens(input: {
  appUserId: string;
  accessToken: string;
  tokenType: string | null;
  accessTokenExpiresAt: Date | null;
}) {
  await cloudSqlPool.query(
    `UPDATE google_user_connections
     SET access_token = $2,
         token_type = COALESCE($3, token_type),
         access_token_expires_at = COALESCE($4, access_token_expires_at),
         last_error = NULL,
         updated_at = now()
     WHERE app_user_id = $1`,
    [input.appUserId, input.accessToken, input.tokenType, input.accessTokenExpiresAt]
  );
}

export async function setGoogleUserConnectionError(
  appUserId: string,
  message: string | null
) {
  await cloudSqlPool.query(
    `UPDATE google_user_connections
     SET last_error = $2, updated_at = now()
     WHERE app_user_id = $1`,
    [appUserId, message]
  );
}

export async function touchGoogleUserSyncAt(appUserId: string) {
  await cloudSqlPool.query(
    `UPDATE google_user_connections
     SET last_sync_at = now(), last_error = NULL, updated_at = now()
     WHERE app_user_id = $1`,
    [appUserId]
  );
}

/** Board members who have Google Tasks tokens stored (can receive list/task sync). */
export async function listBoardMemberAppUserIdsWithGoogleConnection(
  boardId: string
): Promise<string[]> {
  const { rows } = await cloudSqlPool.query<{ app_user_id: string }>(
    `SELECT m.app_user_id
     FROM task_board_members m
     INNER JOIN google_user_connections g ON g.app_user_id = m.app_user_id
     WHERE m.board_id = $1
       AND (g.refresh_token IS NOT NULL OR g.access_token IS NOT NULL)`,
    [boardId]
  );
  return rows.map((r) => r.app_user_id);
}

export async function getGoogleTaskListMap(
  appUserId: string,
  boardId: string
): Promise<GoogleTaskListMap | null> {
  const { rows } = await cloudSqlPool.query<GoogleTaskListMap>(
    `SELECT app_user_id, board_id, google_task_list_id, google_task_list_title
     FROM task_board_google_task_lists
     WHERE app_user_id = $1 AND board_id = $2`,
    [appUserId, boardId]
  );
  return rows[0] ?? null;
}

export async function upsertGoogleTaskListMap(input: {
  appUserId: string;
  boardId: string;
  googleTaskListId: string;
  googleTaskListTitle: string | null;
}) {
  await cloudSqlPool.query(
    `INSERT INTO task_board_google_task_lists (
       app_user_id, board_id, google_task_list_id, google_task_list_title, updated_at
     )
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (app_user_id, board_id) DO UPDATE SET
       google_task_list_id = EXCLUDED.google_task_list_id,
       google_task_list_title = EXCLUDED.google_task_list_title,
       updated_at = now()`,
    [input.appUserId, input.boardId, input.googleTaskListId, input.googleTaskListTitle]
  );
}

export async function getGoogleTaskMapByTodo(
  appUserId: string,
  todoId: string
): Promise<GoogleTaskMapRow | null> {
  const { rows } = await cloudSqlPool.query<GoogleTaskMapRow>(
    `SELECT app_user_id, board_id, todo_id, google_task_list_id, google_task_id,
            source_last_write, source_last_modified_at
     FROM task_board_google_task_map
     WHERE app_user_id = $1 AND todo_id = $2`,
    [appUserId, todoId]
  );
  return rows[0] ?? null;
}

export async function getGoogleTaskMapByRemote(
  appUserId: string,
  googleTaskListId: string,
  googleTaskId: string
): Promise<GoogleTaskMapRow | null> {
  const { rows } = await cloudSqlPool.query<GoogleTaskMapRow>(
    `SELECT app_user_id, board_id, todo_id, google_task_list_id, google_task_id,
            source_last_write, source_last_modified_at
     FROM task_board_google_task_map
     WHERE app_user_id = $1 AND google_task_list_id = $2 AND google_task_id = $3`,
    [appUserId, googleTaskListId, googleTaskId]
  );
  return rows[0] ?? null;
}

export async function upsertGoogleTaskMap(input: {
  appUserId: string;
  boardId: string;
  todoId: string;
  googleTaskListId: string;
  googleTaskId: string;
  sourceLastWrite: "taskboard" | "google";
  sourceLastModifiedAt: Date;
}) {
  await cloudSqlPool.query(
    `INSERT INTO task_board_google_task_map (
       app_user_id, board_id, todo_id, google_task_list_id, google_task_id,
       source_last_write, source_last_modified_at, last_synced_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     ON CONFLICT (app_user_id, todo_id) DO UPDATE SET
       board_id = EXCLUDED.board_id,
       google_task_list_id = EXCLUDED.google_task_list_id,
       google_task_id = EXCLUDED.google_task_id,
       source_last_write = EXCLUDED.source_last_write,
       source_last_modified_at = EXCLUDED.source_last_modified_at,
       last_synced_at = now(),
       deleted_at = NULL,
       updated_at = now()`,
    [
      input.appUserId,
      input.boardId,
      input.todoId,
      input.googleTaskListId,
      input.googleTaskId,
      input.sourceLastWrite,
      input.sourceLastModifiedAt,
    ]
  );
}
