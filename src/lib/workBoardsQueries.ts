import { cloudSqlPool, withCloudSqlTransaction } from "@/lib/cloudSqlPool";
import { DEFAULT_WORK_BOARD_STATUSES } from "@/lib/workStatuses";
import type { WorkBoardStatus } from "@/lib/workStatuses";

export type WorkBoardRow = {
  id: string;
  customer_id: string;
  title: string;
  prefix: string;
  created_by_app_user_id: string;
  created_at: Date;
  updated_at: Date;
  member_ids: string[];
};

export type WorkCustomerRow = {
  id: string;
  name: string;
  color: string | null;
  url: string | null;
  is_internal: boolean;
  is_active: boolean;
};

export async function fetchActiveCustomersByIds(
  customerIds: string[]
): Promise<WorkCustomerRow[]> {
  const unique = [...new Set(customerIds)].filter(Boolean);
  if (unique.length === 0) return [];
  const { rows } = await cloudSqlPool.query<WorkCustomerRow>(
    `SELECT id, name, color, url, is_internal, is_active
     FROM customers
     WHERE id = ANY($1::uuid[])
       AND is_active = true
     ORDER BY is_internal DESC, lower(name)`,
    [unique]
  );
  return rows;
}

export async function fetchActiveCustomers(): Promise<WorkCustomerRow[]> {
  const { rows } = await cloudSqlPool.query<WorkCustomerRow>(
    `SELECT id, name, color, url, is_internal, is_active
     FROM customers
     WHERE is_active = true
     ORDER BY is_internal DESC, lower(name)`
  );
  return rows;
}

export async function fetchWorkBoardsForCustomerIds(
  customerIds: string[]
): Promise<WorkBoardRow[]> {
  const unique = [...new Set(customerIds)].filter(Boolean);
  if (unique.length === 0) return [];
  const { rows } = await cloudSqlPool.query<
    Omit<WorkBoardRow, "member_ids"> & { member_ids: string[] | null }
  >(
    `SELECT
       b.id,
       b.customer_id,
       b.title,
       b.prefix,
       b.created_by_app_user_id,
       b.created_at,
       b.updated_at,
       COALESCE(
         array_agg(m.app_user_id::text) FILTER (WHERE m.app_user_id IS NOT NULL),
         ARRAY[]::text[]
       ) AS member_ids
     FROM work_boards b
     LEFT JOIN work_board_members m ON m.board_id = b.id
     WHERE b.customer_id = ANY($1::uuid[])
     GROUP BY b.id
     ORDER BY lower(b.title)`,
    [unique]
  );
  return rows.map((row) => ({
    ...row,
    member_ids: row.member_ids ?? [],
  }));
}

export async function fetchWorkBoardById(
  boardId: string
): Promise<(WorkBoardRow & { customer_name: string; customer_is_internal: boolean }) | null> {
  const { rows } = await cloudSqlPool.query<
    Omit<WorkBoardRow, "member_ids"> & {
      member_ids: string[] | null;
      customer_name: string;
      customer_is_internal: boolean;
    }
  >(
    `SELECT
       b.id,
       b.customer_id,
       b.title,
       b.prefix,
       b.created_by_app_user_id,
       b.created_at,
       b.updated_at,
       c.name AS customer_name,
       c.is_internal AS customer_is_internal,
       COALESCE(
         array_agg(m.app_user_id::text) FILTER (WHERE m.app_user_id IS NOT NULL),
         ARRAY[]::text[]
       ) AS member_ids
     FROM work_boards b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN work_board_members m ON m.board_id = b.id
     WHERE b.id = $1
     GROUP BY b.id, c.name, c.is_internal`,
    [boardId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    member_ids: row.member_ids ?? [],
  };
}

export async function insertWorkBoard(input: {
  customerId: string;
  title: string;
  prefix: string;
  createdByAppUserId: string;
  memberAppUserIds: string[];
}): Promise<string> {
  const memberIds = [...new Set([input.createdByAppUserId, ...input.memberAppUserIds])].filter(
    Boolean
  );
  return withCloudSqlTransaction("work-create-board", async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO work_boards (customer_id, title, prefix, created_by_app_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [input.customerId, input.title, input.prefix, input.createdByAppUserId]
    );
    const boardId = rows[0]?.id;
    if (!boardId) throw new Error("Failed to create board");
    if (memberIds.length > 0) {
      await client.query(
        `INSERT INTO work_board_members (board_id, app_user_id)
         SELECT $1, unnest($2::uuid[])`,
        [boardId, memberIds]
      );
    }
    await insertDefaultWorkBoardStatuses(client, boardId);
    return boardId;
  });
}

async function insertDefaultWorkBoardStatuses(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  boardId: string
) {
  for (const [index, status] of DEFAULT_WORK_BOARD_STATUSES.entries()) {
    await client.query(
      `INSERT INTO work_board_statuses (board_id, name, sort_order, is_done)
       VALUES ($1, $2, $3, $4)`,
      [boardId, status.name, index, status.isDone]
    );
  }
}

export async function fetchWorkBoardStatuses(
  boardId: string
): Promise<WorkBoardStatus[]> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    sort_order: number;
    is_done: boolean;
  }>(
    `SELECT id, name, sort_order, is_done
     FROM work_board_statuses
     WHERE board_id = $1
     ORDER BY sort_order, name`,
    [boardId]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isDone: row.is_done,
  }));
}

export async function insertWorkBoardStatus(input: {
  boardId: string;
  name: string;
}): Promise<WorkBoardStatus> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    sort_order: number;
    is_done: boolean;
  }>(
    `INSERT INTO work_board_statuses (board_id, name, sort_order, is_done)
     VALUES (
       $1,
       $2,
       (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM work_board_statuses WHERE board_id = $1),
       false
     )
     RETURNING id, name, sort_order, is_done`,
    [input.boardId, input.name]
  );
  const row = rows[0];
  if (!row) throw new Error("Failed to create status");
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isDone: row.is_done,
  };
}

export async function renameWorkBoardStatus(input: {
  boardId: string;
  statusId: string;
  name: string;
}): Promise<WorkBoardStatus> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    name: string;
    sort_order: number;
    is_done: boolean;
  }>(
    `UPDATE work_board_statuses
     SET name = $3
     WHERE id = $2 AND board_id = $1
     RETURNING id, name, sort_order, is_done`,
    [input.boardId, input.statusId, input.name]
  );
  const row = rows[0];
  if (!row) throw new Error("Status not found");
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isDone: row.is_done,
  };
}

export async function reorderWorkBoardStatuses(
  boardId: string,
  statusIds: string[]
): Promise<void> {
  await withCloudSqlTransaction("work-reorder-statuses", async (client) => {
    for (let index = 0; index < statusIds.length; index += 1) {
      await client.query(
        `UPDATE work_board_statuses
         SET sort_order = $3
         WHERE id = $2 AND board_id = $1`,
        [boardId, statusIds[index], index]
      );
    }
  });
}

export async function deleteWorkBoardStatus(input: {
  boardId: string;
  statusId: string;
  moveToStatusId: string | null;
  actorAppUserId: string;
}): Promise<void> {
  await withCloudSqlTransaction("work-delete-status", async (client) => {
    const { rows: statuses } = await client.query<{
      id: string;
      name: string;
    }>(
      `SELECT id, name
       FROM work_board_statuses
       WHERE board_id = $1
       ORDER BY sort_order
       FOR UPDATE`,
      [input.boardId]
    );
    if (statuses.length <= 1) {
      throw new Error("A board needs at least one status");
    }
    const current = statuses.find((row) => row.id === input.statusId);
    if (!current) throw new Error("Status not found");
    const moveTo = input.moveToStatusId
      ? statuses.find((row) => row.id === input.moveToStatusId)
      : null;
    if (input.moveToStatusId && !moveTo) {
      throw new Error("Choose a status to move issues to");
    }
    if (moveTo && moveTo.id === current.id) {
      throw new Error("Choose a different status");
    }

    const { rows: issueRows } = await client.query<{ id: string }>(
      `SELECT id
       FROM work_issues
       WHERE board_id = $1 AND status = $2`,
      [input.boardId, input.statusId]
    );
    if (issueRows.length > 0) {
      if (!moveTo) throw new Error("Choose a status to move issues to");
      await client.query(
        `INSERT INTO work_issue_events (issue_id, actor_app_user_id, kind, summary)
         SELECT i.id, $3, 'status', $4
         FROM work_issues i
         WHERE i.board_id = $1 AND i.status = $2`,
        [
          input.boardId,
          input.statusId,
          input.actorAppUserId,
          `changed status to ${moveTo.name}`,
        ]
      );
      const { rows: orderRows } = await client.query<{ next: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
         FROM work_issues
         WHERE board_id = $1 AND status = $2`,
        [input.boardId, moveTo.id]
      );
      await client.query(
        `UPDATE work_issues AS i
         SET status = $3,
             sort_order = $4 + sub.rn
         FROM (
           SELECT id,
                  ROW_NUMBER() OVER (ORDER BY sort_order, number) - 1 AS rn
           FROM work_issues
           WHERE board_id = $1 AND status = $2
         ) sub
         WHERE i.id = sub.id`,
        [input.boardId, input.statusId, moveTo.id, orderRows[0]?.next ?? 0]
      );
    }

    await client.query(
      `DELETE FROM work_board_statuses
       WHERE id = $1 AND board_id = $2`,
      [input.statusId, input.boardId]
    );

    const remaining = statuses.filter((row) => row.id !== input.statusId);
    for (let index = 0; index < remaining.length; index += 1) {
      await client.query(
        `UPDATE work_board_statuses
         SET sort_order = $3
         WHERE id = $2 AND board_id = $1`,
        [input.boardId, remaining[index].id, index]
      );
    }
  });
}

export async function insertWorkBoardMember(
  boardId: string,
  appUserId: string
): Promise<void> {
  await cloudSqlPool.query(
    `INSERT INTO work_board_members (board_id, app_user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [boardId, appUserId]
  );
}

export async function deleteWorkBoardMember(
  boardId: string,
  appUserId: string
): Promise<void> {
  await cloudSqlPool.query(
    `DELETE FROM work_board_members
     WHERE board_id = $1 AND app_user_id = $2`,
    [boardId, appUserId]
  );
}
