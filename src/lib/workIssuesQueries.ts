import { cloudSqlPool, withCloudSqlTransaction } from "@/lib/cloudSqlPool";
import type { WorkIssueStatus } from "@/lib/workStatuses";

export type WorkUserRow = {
  id: string;
  name: string | null;
  email: string;
};

export type WorkIssueRow = {
  id: string;
  board_id: string;
  number: number;
  title: string;
  status: WorkIssueStatus;
  sort_order: number;
  description: string;
  current_state: string;
  next_step: string;
  owner_app_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  created_by_app_user_id: string;
  reporter_name: string | null;
  reporter_email: string;
  estimate_hours: string | number | null;
};

export async function fetchWorkPeopleForCustomer(
  customerId: string
): Promise<WorkUserRow[]> {
  const { rows } = await cloudSqlPool.query<WorkUserRow>(
    `SELECT u.id, u.name, u.email
     FROM app_users u
     WHERE u.id IN (
       SELECT c.app_user_id
       FROM customer_consultants cc
       JOIN consultants c ON c.id = cc.consultant_id
       WHERE cc.customer_id = $1
         AND c.app_user_id IS NOT NULL
       UNION
       SELECT cau.app_user_id
       FROM customer_app_users cau
       WHERE cau.customer_id = $1
     )
     ORDER BY lower(COALESCE(NULLIF(trim(u.name), ''), u.email))`,
    [customerId]
  );
  return rows;
}

export async function fetchWorkAssigneesForCustomer(
  customerId: string,
  boardId: string
): Promise<WorkUserRow[]> {
  const { rows } = await cloudSqlPool.query<WorkUserRow>(
    `SELECT u.id, u.name, u.email
     FROM app_users u
     WHERE u.id IN (
       SELECT c.app_user_id
       FROM customer_consultants cc
       JOIN consultants c ON c.id = cc.consultant_id
       WHERE cc.customer_id = $1
         AND c.app_user_id IS NOT NULL
       UNION
       SELECT cau.app_user_id
       FROM customer_app_users cau
       WHERE cau.customer_id = $1
       UNION
       SELECT m.app_user_id
       FROM work_board_members m
       WHERE m.board_id = $2
     )
     ORDER BY lower(COALESCE(NULLIF(trim(u.name), ''), u.email))`,
    [customerId, boardId]
  );
  return rows;
}

export async function fetchWorkBoardMembers(
  boardId: string
): Promise<WorkUserRow[]> {
  const { rows } = await cloudSqlPool.query<WorkUserRow>(
    `SELECT u.id, u.name, u.email
     FROM work_board_members m
     JOIN app_users u ON u.id = m.app_user_id
     WHERE m.board_id = $1
     ORDER BY m.created_at, lower(COALESCE(NULLIF(trim(u.name), ''), u.email))`,
    [boardId]
  );
  return rows;
}

export async function fetchWorkIssuesForBoard(
  boardId: string
): Promise<WorkIssueRow[]> {
  const { rows } = await cloudSqlPool.query<WorkIssueRow>(
    `SELECT
       i.id,
       i.board_id,
       i.number,
       i.title,
       i.status,
       i.sort_order,
       i.description,
       i.current_state,
       i.next_step,
       i.owner_app_user_id,
       o.name AS owner_name,
       o.email AS owner_email,
       i.created_by_app_user_id,
       r.name AS reporter_name,
       r.email AS reporter_email,
       i.estimate_hours
     FROM work_issues i
     JOIN app_users r ON r.id = i.created_by_app_user_id
     LEFT JOIN app_users o ON o.id = i.owner_app_user_id
     WHERE i.board_id = $1
     ORDER BY i.status, i.sort_order, i.number`,
    [boardId]
  );
  return rows;
}

export async function fetchIssueAssignees(issueIds: string[]) {
  if (issueIds.length === 0) return [];
  const { rows } = await cloudSqlPool.query<{
    issue_id: string;
    id: string;
    name: string | null;
    email: string;
  }>(
    `SELECT a.issue_id, u.id, u.name, u.email
     FROM work_issue_assignees a
     JOIN app_users u ON u.id = a.app_user_id
     WHERE a.issue_id = ANY($1::uuid[])
     ORDER BY a.created_at ASC, a.app_user_id`,
    [issueIds]
  );
  return rows;
}

export async function fetchIssueLabels(issueIds: string[]) {
  if (issueIds.length === 0) return [];
  const { rows } = await cloudSqlPool.query<{
    issue_id: string;
    id: string;
    name: string;
  }>(
    `SELECT l.issue_id, lab.id, lab.name
     FROM work_issue_label_links l
     JOIN work_issue_labels lab ON lab.id = l.label_id
     WHERE l.issue_id = ANY($1::uuid[])
     ORDER BY lower(lab.name)`,
    [issueIds]
  );
  return rows;
}

export async function fetchBoardLabels(boardId: string) {
  const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
    `SELECT id, name
     FROM work_issue_labels
     WHERE board_id = $1
     ORDER BY lower(name)`,
    [boardId]
  );
  return rows;
}

export async function fetchIssueComments(issueIds: string[]) {
  if (issueIds.length === 0) return [];
  const { rows } = await cloudSqlPool.query<{
    id: string;
    issue_id: string;
    body: string;
    created_at: Date;
    author_id: string;
    author_name: string | null;
    author_email: string;
  }>(
    `SELECT
       c.id,
       c.issue_id,
       c.body,
       c.created_at,
       u.id AS author_id,
       u.name AS author_name,
       u.email AS author_email
     FROM work_issue_comments c
     JOIN app_users u ON u.id = c.author_app_user_id
     WHERE c.issue_id = ANY($1::uuid[])
     ORDER BY c.created_at DESC`,
    [issueIds]
  );
  return rows;
}

export async function fetchIssueEvents(issueIds: string[]) {
  if (issueIds.length === 0) return [];
  const { rows } = await cloudSqlPool.query<{
    id: string;
    issue_id: string;
    kind: string;
    summary: string;
    created_at: Date;
    actor_id: string;
    actor_name: string | null;
    actor_email: string;
  }>(
    `SELECT
       e.id,
       e.issue_id,
       e.kind,
       e.summary,
       e.created_at,
       u.id AS actor_id,
       u.name AS actor_name,
       u.email AS actor_email
     FROM work_issue_events e
     JOIN app_users u ON u.id = e.actor_app_user_id
     WHERE e.issue_id = ANY($1::uuid[])
     ORDER BY e.created_at DESC`,
    [issueIds]
  );
  return rows;
}

export async function fetchIssueFiles(issueIds: string[]) {
  if (issueIds.length === 0) return [];
  const { rows } = await cloudSqlPool.query<{
    id: string;
    issue_id: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    created_at: Date;
  }>(
    `SELECT id, issue_id, file_name, mime_type, byte_size, created_at
     FROM work_issue_files
     WHERE issue_id = ANY($1::uuid[])
     ORDER BY created_at DESC`,
    [issueIds]
  );
  return rows;
}

export async function insertWorkIssueEvent(input: {
  issueId: string;
  actorAppUserId: string;
  kind: string;
  summary: string;
}): Promise<void> {
  await cloudSqlPool.query(
    `INSERT INTO work_issue_events (issue_id, actor_app_user_id, kind, summary)
     VALUES ($1, $2, $3, $4)`,
    [input.issueId, input.actorAppUserId, input.kind, input.summary]
  );
}

export async function insertWorkIssue(input: {
  boardId: string;
  title: string;
  status: WorkIssueStatus;
  createdByAppUserId: string;
}): Promise<string> {
  return withCloudSqlTransaction("work-create-issue", async (client) => {
    await client.query("SELECT id FROM work_boards WHERE id = $1 FOR UPDATE", [
      input.boardId,
    ]);
    const { rows: numberRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(number), 0) + 1 AS next
       FROM work_issues
       WHERE board_id = $1`,
      [input.boardId]
    );
    const { rows: orderRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
       FROM work_issues
       WHERE board_id = $1 AND status = $2`,
      [input.boardId, input.status]
    );
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO work_issues (
         board_id, number, title, status, sort_order,
         owner_app_user_id, created_by_app_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.boardId,
        numberRows[0]?.next ?? 1,
        input.title,
        input.status,
        orderRows[0]?.next ?? 0,
        input.createdByAppUserId,
        input.createdByAppUserId,
      ]
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("Failed to create issue");
    await client.query(
      `INSERT INTO work_issue_events (issue_id, actor_app_user_id, kind, summary)
       VALUES ($1, $2, 'created', 'created the issue')`,
      [id, input.createdByAppUserId]
    );
    return id;
  });
}

export async function updateWorkIssueTitle(
  boardId: string,
  issueId: string,
  title: string
): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `UPDATE work_issues SET title = $3 WHERE id = $2 AND board_id = $1`,
    [boardId, issueId, title]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function updateWorkIssueOwner(
  boardId: string,
  issueId: string,
  ownerAppUserId: string | null
): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `UPDATE work_issues SET owner_app_user_id = $3 WHERE id = $2 AND board_id = $1`,
    [boardId, issueId, ownerAppUserId]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function updateWorkIssueField(
  boardId: string,
  issueId: string,
  field: "description" | "current_state" | "next_step",
  value: string
): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `UPDATE work_issues SET ${field} = $3 WHERE id = $2 AND board_id = $1`,
    [boardId, issueId, value]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function updateWorkIssueEstimate(
  boardId: string,
  issueId: string,
  estimateHours: number | null
): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `UPDATE work_issues SET estimate_hours = $3 WHERE id = $2 AND board_id = $1`,
    [boardId, issueId, estimateHours]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function fetchLoggedHoursByIssueIds(
  issueIds: string[]
): Promise<Map<string, number>> {
  const hours = new Map<string, number>();
  if (issueIds.length === 0) return hours;
  const { rows } = await cloudSqlPool.query<{
    work_issue_id: string;
    hours: string | number | null;
  }>(
    `SELECT l.work_issue_id, COALESCE(SUM(e.hours), 0) AS hours
     FROM time_report_entry_lines l
     JOIN time_report_entries e
       ON e.entry_line_id = l.id
      AND e.consultant_id = l.consultant_id
     WHERE l.work_issue_id = ANY($1::uuid[])
     GROUP BY l.work_issue_id`,
    [issueIds]
  );
  for (const row of rows) {
    hours.set(row.work_issue_id, Number(row.hours ?? 0));
  }
  return hours;
}

export async function addWorkIssueAssignee(
  issueId: string,
  appUserId: string
): Promise<void> {
  await cloudSqlPool.query(
    `INSERT INTO work_issue_assignees (issue_id, app_user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [issueId, appUserId]
  );
}

export async function removeWorkIssueAssignee(
  issueId: string,
  appUserId: string
): Promise<void> {
  await cloudSqlPool.query(
    `DELETE FROM work_issue_assignees WHERE issue_id = $1 AND app_user_id = $2`,
    [issueId, appUserId]
  );
}

export async function findOrCreateBoardLabel(
  boardId: string,
  name: string
): Promise<{ id: string; name: string }> {
  const { rows: existing } = await cloudSqlPool.query<{
    id: string;
    name: string;
  }>(
    `SELECT id, name
     FROM work_issue_labels
     WHERE board_id = $1 AND lower(name) = lower($2)`,
    [boardId, name]
  );
  if (existing[0]) return existing[0];
  try {
    const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
      `INSERT INTO work_issue_labels (board_id, name)
       VALUES ($1, $2)
       RETURNING id, name`,
      [boardId, name]
    );
    const row = rows[0];
    if (!row) throw new Error("Failed to save label");
    return row;
  } catch (error) {
    const { rows } = await cloudSqlPool.query<{ id: string; name: string }>(
      `SELECT id, name
       FROM work_issue_labels
       WHERE board_id = $1 AND lower(name) = lower($2)`,
      [boardId, name]
    );
    if (rows[0]) return rows[0];
    throw error;
  }
}

export async function linkWorkIssueLabel(
  issueId: string,
  labelId: string
): Promise<void> {
  await cloudSqlPool.query(
    `INSERT INTO work_issue_label_links (issue_id, label_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [issueId, labelId]
  );
}

export async function unlinkWorkIssueLabel(
  issueId: string,
  labelId: string
): Promise<void> {
  await cloudSqlPool.query(
    `DELETE FROM work_issue_label_links WHERE issue_id = $1 AND label_id = $2`,
    [issueId, labelId]
  );
}

export async function insertWorkIssueComment(input: {
  issueId: string;
  authorAppUserId: string;
  body: string;
}): Promise<string> {
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `INSERT INTO work_issue_comments (issue_id, author_app_user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [input.issueId, input.authorAppUserId, input.body]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to add comment");
  return id;
}

export async function updateWorkIssueComment(input: {
  commentId: string;
  issueId: string;
  authorAppUserId: string;
  body: string;
}): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `UPDATE work_issue_comments
     SET body = $4
     WHERE id = $1 AND issue_id = $2 AND author_app_user_id = $3`,
    [input.commentId, input.issueId, input.authorAppUserId, input.body]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteWorkIssueComment(input: {
  commentId: string;
  issueId: string;
  authorAppUserId: string;
}): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `DELETE FROM work_issue_comments
     WHERE id = $1 AND issue_id = $2 AND author_app_user_id = $3`,
    [input.commentId, input.issueId, input.authorAppUserId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function fetchWorkIssueNotifyMeta(
  boardId: string,
  issueId: string
): Promise<{ number: number; title: string } | null> {
  const { rows } = await cloudSqlPool.query<{ number: number; title: string }>(
    `SELECT number, title
     FROM work_issues
     WHERE id = $1 AND board_id = $2`,
    [issueId, boardId]
  );
  return rows[0] ?? null;
}

export async function moveWorkIssue(input: {
  boardId: string;
  issueId: string;
  status: WorkIssueStatus;
  sortOrder: number;
}): Promise<boolean> {
  const result = await cloudSqlPool.query(
    `UPDATE work_issues
     SET status = $3, sort_order = $4
     WHERE id = $2 AND board_id = $1`,
    [input.boardId, input.issueId, input.status, input.sortOrder]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function fetchWorkIssueStatus(
  boardId: string,
  issueId: string
): Promise<WorkIssueStatus | null> {
  const { rows } = await cloudSqlPool.query<{ status: WorkIssueStatus }>(
    `SELECT status FROM work_issues WHERE id = $2 AND board_id = $1`,
    [boardId, issueId]
  );
  return rows[0]?.status ?? null;
}

export async function reorderWorkIssuesInStatus(input: {
  boardId: string;
  status: WorkIssueStatus;
  issueIds: string[];
}): Promise<void> {
  await withCloudSqlTransaction("work-reorder-issues", async (client) => {
    for (let index = 0; index < input.issueIds.length; index += 1) {
      await client.query(
        `UPDATE work_issues
         SET status = $3, sort_order = $4
         WHERE id = $2 AND board_id = $1`,
        [input.boardId, input.issueIds[index], input.status, index]
      );
    }
  });
}

export async function insertWorkIssueFile(input: {
  issueId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  content: Buffer;
  uploadedByAppUserId: string;
}): Promise<string> {
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `INSERT INTO work_issue_files (
       issue_id, file_name, mime_type, byte_size, content, uploaded_by_app_user_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.issueId,
      input.fileName,
      input.mimeType,
      input.byteSize,
      input.content,
      input.uploadedByAppUserId,
    ]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to upload file");
  return id;
}

export async function fetchWorkIssueFileForDownload(fileId: string): Promise<{
  id: string;
  issue_id: string;
  board_id: string;
  file_name: string;
  mime_type: string;
  content: Buffer;
} | null> {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    issue_id: string;
    board_id: string;
    file_name: string;
    mime_type: string;
    content: Buffer;
  }>(
    `SELECT f.id, f.issue_id, i.board_id, f.file_name, f.mime_type, f.content
     FROM work_issue_files f
     JOIN work_issues i ON i.id = f.issue_id
     WHERE f.id = $1`,
    [fileId]
  );
  return rows[0] ?? null;
}

export async function deleteWorkIssueFile(
  issueId: string,
  fileId: string
): Promise<string | null> {
  const { rows } = await cloudSqlPool.query<{ file_name: string }>(
    `DELETE FROM work_issue_files
     WHERE id = $2 AND issue_id = $1
     RETURNING file_name`,
    [issueId, fileId]
  );
  return rows[0]?.file_name ?? null;
}

export async function fetchWorkIssueRelations(boardId: string) {
  const { rows } = await cloudSqlPool.query<{
    id: string;
    board_id: string;
    from_issue_id: string;
    to_issue_id: string;
    kind: "blocks" | "relates" | "parent";
  }>(
    `SELECT id, board_id, from_issue_id, to_issue_id, kind
     FROM work_issue_relations
     WHERE board_id = $1`,
    [boardId]
  );
  return rows;
}

export async function insertWorkIssueRelation(input: {
  boardId: string;
  fromIssueId: string;
  toIssueId: string;
  kind: "blocks" | "relates" | "parent";
}): Promise<string> {
  const { rows } = await cloudSqlPool.query<{ id: string }>(
    `INSERT INTO work_issue_relations (board_id, from_issue_id, to_issue_id, kind)
     SELECT $1, $2, $3, $4
     WHERE EXISTS (
       SELECT 1 FROM work_issues WHERE id = $2 AND board_id = $1
     )
       AND EXISTS (
         SELECT 1 FROM work_issues WHERE id = $3 AND board_id = $1
       )
     RETURNING id`,
    [input.boardId, input.fromIssueId, input.toIssueId, input.kind]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Issue not found");
  return id;
}

export async function deleteWorkIssueRelation(
  boardId: string,
  relationId: string
): Promise<{ fromIssueId: string; toIssueId: string; kind: string } | null> {
  const { rows } = await cloudSqlPool.query<{
    from_issue_id: string;
    to_issue_id: string;
    kind: string;
  }>(
    `DELETE FROM work_issue_relations
     WHERE id = $2 AND board_id = $1
     RETURNING from_issue_id, to_issue_id, kind`,
    [boardId, relationId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    fromIssueId: row.from_issue_id,
    toIssueId: row.to_issue_id,
    kind: row.kind,
  };
}
